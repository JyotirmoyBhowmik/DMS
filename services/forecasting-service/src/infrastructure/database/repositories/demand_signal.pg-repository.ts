import { DemandSignalAggregate, DemandSignalType, DemandSignalStatus } from '../../../domain/entities/demand_signal.entity.js';
import { DemandSignalFilter, DemandSignalRepository } from '../../../domain/repositories/demand_signal.repository.js';

export class DemandSignalPgRepository implements DemandSignalRepository {
  private inMemoryDb: Map<string, DemandSignalAggregate>;

  constructor(
    private readonly pool?: any,
    sharedStore?: Map<string, DemandSignalAggregate>
  ) {
    this.inMemoryDb = sharedStore ?? new Map<string, DemandSignalAggregate>();
  }

  public async save(signal: DemandSignalAggregate): Promise<DemandSignalAggregate> {
    if (this.pool && typeof this.pool.connect === 'function') {
      const client = await this.pool.connect();
      try {
        await client.query("SELECT set_config('app.current_tenant_id', $1, true)", [signal.tenantId]);
        
        const existing = await client.query(
          'SELECT version FROM demand_signals WHERE id = $1 AND tenant_id = $2',
          [signal.id, signal.tenantId]
        );

        if (existing.rows.length > 0) {
          const currentVersion = existing.rows[0].version;
          if (currentVersion !== signal.version - 1) {
            throw new Error(`Optimistic locking failure: expected version ${signal.version - 1}, found ${currentVersion}`);
          }
          await client.query(
            `UPDATE demand_signals 
             SET signal_name = $1, signal_type = $2, signal_value = $3, confidence_score = $4, status = $5, source_channel = $6, version = $7, updated_at = NOW()
             WHERE id = $8 AND tenant_id = $9`,
            [
              signal.signalName,
              signal.signalType,
              signal.signalValue,
              signal.confidenceScore,
              signal.status,
              signal.sourceChannel,
              signal.version,
              signal.id,
              signal.tenantId
            ]
          );
        } else {
          await client.query(
            `INSERT INTO demand_signals (id, tenant_id, signal_name, signal_type, signal_value, confidence_score, status, source_channel, version, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
            [
              signal.id,
              signal.tenantId,
              signal.signalName,
              signal.signalType,
              signal.signalValue,
              signal.confidenceScore,
              signal.status,
              signal.sourceChannel,
              signal.version,
              signal.createdAt,
              signal.updatedAt
            ]
          );
        }
      } finally {
        client.release();
      }
    } else {
      const key = `${signal.tenantId}:${signal.id}`;
      this.inMemoryDb.set(key, signal);
    }
    return signal;
  }

  public async findById(id: string, tenantId: string): Promise<DemandSignalAggregate | null> {
    if (this.pool && typeof this.pool.connect === 'function') {
      const client = await this.pool.connect();
      try {
        await client.query("SELECT set_config('app.current_tenant_id', $1, true)", [tenantId]);
        const res = await client.query(
          'SELECT * FROM demand_signals WHERE id = $1 AND tenant_id = $2',
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

  public async findByName(signalName: string, tenantId: string): Promise<DemandSignalAggregate | null> {
    if (this.pool && typeof this.pool.connect === 'function') {
      const client = await this.pool.connect();
      try {
        await client.query("SELECT set_config('app.current_tenant_id', $1, true)", [tenantId]);
        const res = await client.query(
          'SELECT * FROM demand_signals WHERE signal_name = $1 AND tenant_id = $2',
          [signalName, tenantId]
        );
        if (res.rows.length === 0) return null;
        return this.mapToAggregate(res.rows[0]);
      } finally {
        client.release();
      }
    } else {
      const target = Array.from(this.inMemoryDb.values()).find(
        item => item.tenantId === tenantId && item.signalName === signalName
      );
      return target ?? null;
    }
  }

  public async findAll(filter: DemandSignalFilter): Promise<{ signals: DemandSignalAggregate[]; total: number; page: number; pageSize: number }> {
    const page = filter.page ?? 1;
    const pageSize = filter.pageSize ?? 20;

    if (this.pool && typeof this.pool.connect === 'function') {
      const client = await this.pool.connect();
      try {
        await client.query("SELECT set_config('app.current_tenant_id', $1, true)", [filter.tenantId]);
        
        let query = 'SELECT * FROM demand_signals WHERE tenant_id = $1';
        let countQuery = 'SELECT COUNT(*) FROM demand_signals WHERE tenant_id = $1';
        const params: any[] = [filter.tenantId];
        let paramIdx = 2;

        if (filter.signalName) {
          query += ` AND signal_name ILIKE $${paramIdx}`;
          countQuery += ` AND signal_name ILIKE $${paramIdx}`;
          params.push(`%${filter.signalName}%`);
          paramIdx++;
        }
        if (filter.signalType) {
          query += ` AND signal_type = $${paramIdx}`;
          countQuery += ` AND signal_type = $${paramIdx}`;
          params.push(filter.signalType);
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

        const sortBy = filter.sortBy === 'signalName' ? 'signal_name' : 'created_at';
        const sortOrder = filter.sortOrder === 'asc' ? 'ASC' : 'DESC';
        query += ` ORDER BY ${sortBy} ${sortOrder} LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`;
        params.push(pageSize, (page - 1) * pageSize);

        const res = await client.query(query, params);
        const signals = res.rows.map((r: any) => this.mapToAggregate(r));

        return { signals, total, page, pageSize };
      } finally {
        client.release();
      }
    } else {
      let items = Array.from(this.inMemoryDb.values()).filter(item => item.tenantId === filter.tenantId);

      if (filter.signalName) {
        const q = filter.signalName.toLowerCase();
        items = items.filter(i => i.signalName.toLowerCase().includes(q));
      }
      if (filter.signalType) {
        items = items.filter(i => i.signalType === filter.signalType);
      }
      if (filter.status) {
        items = items.filter(i => i.status === filter.status);
      }

      const total = items.length;
      items.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

      const start = (page - 1) * pageSize;
      const paginated = items.slice(start, start + pageSize);

      return { signals: paginated, total, page, pageSize };
    }
  }

  public async delete(id: string, tenantId: string): Promise<boolean> {
    if (this.pool && typeof this.pool.connect === 'function') {
      const client = await this.pool.connect();
      try {
        await client.query("SELECT set_config('app.current_tenant_id', $1, true)", [tenantId]);
        const res = await client.query('DELETE FROM demand_signals WHERE id = $1 AND tenant_id = $2', [id, tenantId]);
        return (res.rowCount ?? 0) > 0;
      } finally {
        client.release();
      }
    } else {
      const key = `${tenantId}:${id}`;
      return this.inMemoryDb.delete(key);
    }
  }

  private mapToAggregate(row: any): DemandSignalAggregate {
    return new DemandSignalAggregate({
      id: row.id,
      tenantId: row.tenant_id,
      signalName: row.signal_name,
      signalType: row.signal_type as DemandSignalType,
      signalValue: parseFloat(row.signal_value),
      confidenceScore: parseFloat(row.confidence_score),
      status: row.status as DemandSignalStatus,
      sourceChannel: row.source_channel ?? 'SYSTEM',
      version: row.version,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    });
  }
}
