import { ReportAggregate, ReportStatus, ReportType } from '../../../domain/entities/report.entity.js';
import { ReportFilter, ReportRepository } from '../../../domain/repositories/report.repository.js';

export class ReportPgRepository implements ReportRepository {
  private inMemoryDb: Map<string, ReportAggregate>;

  constructor(
    private readonly pool?: any,
    sharedStore?: Map<string, ReportAggregate>
  ) {
    this.inMemoryDb = sharedStore ?? new Map<string, ReportAggregate>();
  }

  public async save(report: ReportAggregate): Promise<ReportAggregate> {
    if (this.pool && typeof this.pool.connect === 'function') {
      const client = await this.pool.connect();
      try {
        await client.query("SELECT set_config('app.current_tenant_id', $1, true)", [report.tenantId]);
        
        const existing = await client.query(
          'SELECT version FROM reports WHERE id = $1 AND tenant_id = $2',
          [report.id, report.tenantId]
        );

        if (existing.rows.length > 0) {
          const currentVersion = existing.rows[0].version;
          if (currentVersion !== report.version - 1) {
            throw new Error(`Optimistic locking failure: expected version ${report.version - 1}, found ${currentVersion}`);
          }
          await client.query(
            `UPDATE reports 
             SET name = $1, status = $2, download_url = $3, version = $4, updated_at = NOW()
             WHERE id = $5 AND tenant_id = $6`,
            [
              report.name,
              report.status,
              report.downloadUrl ?? null,
              report.version,
              report.id,
              report.tenantId
            ]
          );
        } else {
          await client.query(
            `INSERT INTO reports (id, tenant_id, name, type, parameters, status, download_url, version, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
            [
              report.id,
              report.tenantId,
              report.name,
              report.type,
              JSON.stringify(report.parameters),
              report.status,
              report.downloadUrl ?? null,
              report.version,
              report.createdAt,
              report.updatedAt
            ]
          );
        }
      } finally {
        client.release();
      }
    } else {
      const key = `${report.tenantId}:${report.id}`;
      this.inMemoryDb.set(key, report);
    }
    return report;
  }

  public async findById(id: string, tenantId: string): Promise<ReportAggregate | null> {
    if (this.pool && typeof this.pool.connect === 'function') {
      const client = await this.pool.connect();
      try {
        await client.query("SELECT set_config('app.current_tenant_id', $1, true)", [tenantId]);
        const res = await client.query(
          'SELECT * FROM reports WHERE id = $1 AND tenant_id = $2',
          [id, tenantId]
        );
        if (res.rows.length === 0) return null;
        return this.mapToAggregate(res.rows[0]);
      } finally {
        client.release();
      }
    } else {
      const key = `${tenantId}:${id}`;
      const item = this.inMemoryDb.get(key);
      return item ?? null;
    }
  }

  public async findAll(filter: ReportFilter): Promise<{ reports: ReportAggregate[]; total: number; page: number; pageSize: number }> {
    const page = filter.page ?? 1;
    const pageSize = filter.pageSize ?? 20;

    if (this.pool && typeof this.pool.connect === 'function') {
      const client = await this.pool.connect();
      try {
        await client.query("SELECT set_config('app.current_tenant_id', $1, true)", [filter.tenantId]);
        
        let query = 'SELECT * FROM reports WHERE tenant_id = $1';
        let countQuery = 'SELECT COUNT(*) FROM reports WHERE tenant_id = $1';
        const params: any[] = [filter.tenantId];
        let paramIdx = 2;

        if (filter.name) {
          query += ` AND name ILIKE $${paramIdx}`;
          countQuery += ` AND name ILIKE $${paramIdx}`;
          params.push(`%${filter.name}%`);
          paramIdx++;
        }
        if (filter.type) {
          query += ` AND type = $${paramIdx}`;
          countQuery += ` AND type = $${paramIdx}`;
          params.push(filter.type);
          paramIdx++;
        }
        if (filter.status) {
          query += ` AND status = $${paramIdx}`;
          countQuery += ` AND status = $${paramIdx}`;
          params.push(filter.status);
          paramIdx++;
        }

        const countRes = await client.query(countQuery, params);
        const total = parseInt(countRes.rows[0].count, 10);

        const sortBy = filter.sortBy === 'name' ? 'name' : 'created_at';
        const sortOrder = filter.sortOrder === 'asc' ? 'ASC' : 'DESC';
        query += ` ORDER BY ${sortBy} ${sortOrder} LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`;
        params.push(pageSize, (page - 1) * pageSize);

        const res = await client.query(query, params);
        const reports = res.rows.map((r: any) => this.mapToAggregate(r));

        return { reports, total, page, pageSize };
      } finally {
        client.release();
      }
    } else {
      let items = Array.from(this.inMemoryDb.values()).filter(item => item.tenantId === filter.tenantId);

      if (filter.name) {
        const q = filter.name.toLowerCase();
        items = items.filter(i => i.name.toLowerCase().includes(q));
      }
      if (filter.type) {
        items = items.filter(i => i.type === filter.type);
      }
      if (filter.status) {
        items = items.filter(i => i.status === filter.status);
      }

      const total = items.length;
      items.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

      const start = (page - 1) * pageSize;
      const paginated = items.slice(start, start + pageSize);

      return { reports: paginated, total, page, pageSize };
    }
  }

  public async delete(id: string, tenantId: string): Promise<boolean> {
    if (this.pool && typeof this.pool.connect === 'function') {
      const client = await this.pool.connect();
      try {
        await client.query("SELECT set_config('app.current_tenant_id', $1, true)", [tenantId]);
        const res = await client.query('DELETE FROM reports WHERE id = $1 AND tenant_id = $2', [id, tenantId]);
        return (res.rowCount ?? 0) > 0;
      } finally {
        client.release();
      }
    } else {
      const key = `${tenantId}:${id}`;
      return this.inMemoryDb.delete(key);
    }
  }

  private mapToAggregate(row: any): ReportAggregate {
    return new ReportAggregate({
      id: row.id,
      tenantId: row.tenant_id,
      name: row.name,
      type: row.type as ReportType,
      parameters: typeof row.parameters === 'string' ? JSON.parse(row.parameters) : row.parameters,
      status: row.status as ReportStatus,
      downloadUrl: row.download_url,
      version: row.version,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    });
  }
}
