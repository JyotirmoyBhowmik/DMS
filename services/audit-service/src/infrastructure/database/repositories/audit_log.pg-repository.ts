import { AuditLogAggregate, AuditLogSource, AuditLogStatus } from '../../../domain/entities/audit_log.entity.js';
import { AuditLogFilter, AuditLogRepository } from '../../../domain/repositories/audit_log.repository.js';

export class AuditLogPgRepository implements AuditLogRepository {
  private inMemoryDb: Map<string, AuditLogAggregate>;

  constructor(
    private readonly pool?: any,
    sharedStore?: Map<string, AuditLogAggregate>
  ) {
    this.inMemoryDb = sharedStore ?? new Map<string, AuditLogAggregate>();
  }

  public async save(auditLog: AuditLogAggregate): Promise<AuditLogAggregate> {
    if (this.pool && typeof this.pool.connect === 'function') {
      const client = await this.pool.connect();
      try {
        await client.query("SELECT set_config('app.current_tenant_id', $1, true)", [auditLog.tenantId]);
        
        const existing = await client.query(
          'SELECT version FROM audit_logs WHERE id = $1 AND tenant_id = $2',
          [auditLog.id, auditLog.tenantId]
        );

        if (existing.rows.length > 0) {
          const currentVersion = existing.rows[0].version;
          if (currentVersion !== auditLog.version - 1) {
            throw new Error(`Optimistic locking failure: expected version ${auditLog.version - 1}, found ${currentVersion}`);
          }
          await client.query(
            `UPDATE audit_logs 
             SET status = $1, details = $2, version = $3, updated_at = NOW()
             WHERE id = $4 AND tenant_id = $5`,
            [
              auditLog.status,
              JSON.stringify(auditLog.details),
              auditLog.version,
              auditLog.id,
              auditLog.tenantId
            ]
          );
        } else {
          await client.query(
            `INSERT INTO audit_logs (id, tenant_id, actor_id, action, entity_type, entity_id, source, correlation_id, details, ip_address, status, version, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
            [
              auditLog.id,
              auditLog.tenantId,
              auditLog.actorId,
              auditLog.action,
              auditLog.entityType,
              auditLog.entityId,
              auditLog.source,
              auditLog.correlationId ?? null,
              JSON.stringify(auditLog.details),
              auditLog.ipAddress ?? null,
              auditLog.status,
              auditLog.version,
              auditLog.createdAt,
              auditLog.updatedAt
            ]
          );
        }
      } finally {
        client.release();
      }
    } else {
      const key = `${auditLog.tenantId}:${auditLog.id}`;
      this.inMemoryDb.set(key, auditLog);
    }
    return auditLog;
  }

  public async findById(id: string, tenantId: string): Promise<AuditLogAggregate | null> {
    if (this.pool && typeof this.pool.connect === 'function') {
      const client = await this.pool.connect();
      try {
        await client.query("SELECT set_config('app.current_tenant_id', $1, true)", [tenantId]);
        const res = await client.query(
          'SELECT * FROM audit_logs WHERE id = $1 AND tenant_id = $2',
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

  public async findAll(filter: AuditLogFilter): Promise<{ auditLogs: AuditLogAggregate[]; total: number; page: number; pageSize: number }> {
    const page = filter.page ?? 1;
    const pageSize = filter.pageSize ?? 20;

    if (this.pool && typeof this.pool.connect === 'function') {
      const client = await this.pool.connect();
      try {
        await client.query("SELECT set_config('app.current_tenant_id', $1, true)", [filter.tenantId]);
        
        let query = 'SELECT * FROM audit_logs WHERE tenant_id = $1';
        let countQuery = 'SELECT COUNT(*) FROM audit_logs WHERE tenant_id = $1';
        const params: any[] = [filter.tenantId];
        let paramIdx = 2;

        if (filter.actorId) {
          query += ` AND actor_id = $${paramIdx}`;
          countQuery += ` AND actor_id = $${paramIdx}`;
          params.push(filter.actorId);
          paramIdx++;
        }
        if (filter.action) {
          query += ` AND action ILIKE $${paramIdx}`;
          countQuery += ` AND action ILIKE $${paramIdx}`;
          params.push(`%${filter.action}%`);
          paramIdx++;
        }
        if (filter.entityType) {
          query += ` AND entity_type = $${paramIdx}`;
          countQuery += ` AND entity_type = $${paramIdx}`;
          params.push(filter.entityType);
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

        const sortBy = filter.sortBy === 'action' ? 'action' : 'created_at';
        const sortOrder = filter.sortOrder === 'asc' ? 'ASC' : 'DESC';
        query += ` ORDER BY ${sortBy} ${sortOrder} LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`;
        params.push(pageSize, (page - 1) * pageSize);

        const res = await client.query(query, params);
        const auditLogs = res.rows.map((r: any) => this.mapToAggregate(r));

        return { auditLogs, total, page, pageSize };
      } finally {
        client.release();
      }
    } else {
      let items = Array.from(this.inMemoryDb.values()).filter(item => item.tenantId === filter.tenantId);

      if (filter.actorId) {
        items = items.filter(i => i.actorId === filter.actorId);
      }
      if (filter.action) {
        const q = filter.action.toLowerCase();
        items = items.filter(i => i.action.toLowerCase().includes(q));
      }
      if (filter.entityType) {
        items = items.filter(i => i.entityType === filter.entityType);
      }
      if (filter.status) {
        items = items.filter(i => i.status === filter.status);
      }

      const total = items.length;
      items.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

      const start = (page - 1) * pageSize;
      const paginated = items.slice(start, start + pageSize);

      return { auditLogs: paginated, total, page, pageSize };
    }
  }

  public async delete(id: string, tenantId: string): Promise<boolean> {
    if (this.pool && typeof this.pool.connect === 'function') {
      const client = await this.pool.connect();
      try {
        await client.query("SELECT set_config('app.current_tenant_id', $1, true)", [tenantId]);
        const res = await client.query('DELETE FROM audit_logs WHERE id = $1 AND tenant_id = $2', [id, tenantId]);
        return (res.rowCount ?? 0) > 0;
      } finally {
        client.release();
      }
    } else {
      const key = `${tenantId}:${id}`;
      return this.inMemoryDb.delete(key);
    }
  }

  private mapToAggregate(row: any): AuditLogAggregate {
    return new AuditLogAggregate({
      id: row.id,
      tenantId: row.tenant_id,
      actorId: row.actor_id,
      action: row.action,
      entityType: row.entity_type,
      entityId: row.entity_id,
      source: row.source as AuditLogSource,
      correlationId: row.correlation_id,
      details: typeof row.details === 'string' ? JSON.parse(row.details) : row.details,
      ipAddress: row.ip_address,
      status: row.status as AuditLogStatus,
      version: row.version,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    });
  }
}
