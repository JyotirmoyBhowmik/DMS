import { FeatureFlagAggregate, FlagStrategy, FlagStatus } from '../../../domain/entities/feature_flag.entity.js';
import { FeatureFlagFilter, FeatureFlagRepository } from '../../../domain/repositories/feature_flag.repository.js';

export class FeatureFlagPgRepository implements FeatureFlagRepository {
  private inMemoryDb: Map<string, FeatureFlagAggregate>;

  constructor(
    private readonly pool?: any,
    sharedStore?: Map<string, FeatureFlagAggregate>
  ) {
    this.inMemoryDb = sharedStore ?? new Map<string, FeatureFlagAggregate>();
  }

  public async save(flag: FeatureFlagAggregate): Promise<FeatureFlagAggregate> {
    if (this.pool && typeof this.pool.connect === 'function') {
      const client = await this.pool.connect();
      try {
        await client.query("SELECT set_config('app.current_tenant_id', $1, true)", [flag.tenantId]);
        
        const existing = await client.query(
          'SELECT version FROM feature_flags WHERE id = $1 AND tenant_id = $2',
          [flag.id, flag.tenantId]
        );

        if (existing.rows.length > 0) {
          const currentVersion = existing.rows[0].version;
          if (currentVersion !== flag.version - 1) {
            throw new Error(`Optimistic locking failure: expected version ${flag.version - 1}, found ${currentVersion}`);
          }
          await client.query(
            `UPDATE feature_flags 
             SET flag_key = $1, description = $2, strategy = $3, enabled = $4, rollout_percentage = $5, target_rules = $6, status = $7, version = $8, updated_at = NOW()
             WHERE id = $9 AND tenant_id = $10`,
            [
              flag.flagKey,
              flag.description,
              flag.strategy,
              flag.enabled,
              flag.rolloutPercentage,
              JSON.stringify(flag.targetRules),
              flag.status,
              flag.version,
              flag.id,
              flag.tenantId
            ]
          );
        } else {
          await client.query(
            `INSERT INTO feature_flags (id, tenant_id, flag_key, description, strategy, enabled, rollout_percentage, target_rules, status, version, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
            [
              flag.id,
              flag.tenantId,
              flag.flagKey,
              flag.description,
              flag.strategy,
              flag.enabled,
              flag.rolloutPercentage,
              JSON.stringify(flag.targetRules),
              flag.status,
              flag.version,
              flag.createdAt,
              flag.updatedAt
            ]
          );
        }
      } finally {
        client.release();
      }
    } else {
      const key = `${flag.tenantId}:${flag.id}`;
      this.inMemoryDb.set(key, flag);
    }
    return flag;
  }

  public async findById(id: string, tenantId: string): Promise<FeatureFlagAggregate | null> {
    if (this.pool && typeof this.pool.connect === 'function') {
      const client = await this.pool.connect();
      try {
        await client.query("SELECT set_config('app.current_tenant_id', $1, true)", [tenantId]);
        const res = await client.query(
          'SELECT * FROM feature_flags WHERE id = $1 AND tenant_id = $2',
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

  public async findByKey(flagKey: string, tenantId: string): Promise<FeatureFlagAggregate | null> {
    if (this.pool && typeof this.pool.connect === 'function') {
      const client = await this.pool.connect();
      try {
        await client.query("SELECT set_config('app.current_tenant_id', $1, true)", [tenantId]);
        const res = await client.query(
          'SELECT * FROM feature_flags WHERE flag_key = $1 AND tenant_id = $2',
          [flagKey, tenantId]
        );
        if (res.rows.length === 0) return null;
        return this.mapToAggregate(res.rows[0]);
      } finally {
        client.release();
      }
    } else {
      const target = Array.from(this.inMemoryDb.values()).find(
        item => item.tenantId === tenantId && item.flagKey === flagKey
      );
      return target ?? null;
    }
  }

  public async findAll(filter: FeatureFlagFilter): Promise<{ flags: FeatureFlagAggregate[]; total: number; page: number; pageSize: number }> {
    const page = filter.page ?? 1;
    const pageSize = filter.pageSize ?? 20;

    if (this.pool && typeof this.pool.connect === 'function') {
      const client = await this.pool.connect();
      try {
        await client.query("SELECT set_config('app.current_tenant_id', $1, true)", [filter.tenantId]);
        
        let query = 'SELECT * FROM feature_flags WHERE tenant_id = $1';
        let countQuery = 'SELECT COUNT(*) FROM feature_flags WHERE tenant_id = $1';
        const params: any[] = [filter.tenantId];
        let paramIdx = 2;

        if (filter.flagKey) {
          query += ` AND flag_key ILIKE $${paramIdx}`;
          countQuery += ` AND flag_key ILIKE $${paramIdx}`;
          params.push(`%${filter.flagKey}%`);
          paramIdx++;
        }
        if (filter.strategy) {
          query += ` AND strategy = $${paramIdx}`;
          countQuery += ` AND strategy = $${paramIdx}`;
          params.push(filter.strategy);
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

        const sortBy = filter.sortBy === 'flagKey' ? 'flag_key' : 'created_at';
        const sortOrder = filter.sortOrder === 'asc' ? 'ASC' : 'DESC';
        query += ` ORDER BY ${sortBy} ${sortOrder} LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`;
        params.push(pageSize, (page - 1) * pageSize);

        const res = await client.query(query, params);
        const flags = res.rows.map((r: any) => this.mapToAggregate(r));

        return { flags, total, page, pageSize };
      } finally {
        client.release();
      }
    } else {
      let items = Array.from(this.inMemoryDb.values()).filter(item => item.tenantId === filter.tenantId);

      if (filter.flagKey) {
        const q = filter.flagKey.toLowerCase();
        items = items.filter(i => i.flagKey.toLowerCase().includes(q));
      }
      if (filter.strategy) {
        items = items.filter(i => i.strategy === filter.strategy);
      }
      if (filter.status) {
        items = items.filter(i => i.status === filter.status);
      }
      if (filter.enabled !== undefined) {
        items = items.filter(i => i.enabled === filter.enabled);
      }

      const total = items.length;
      items.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

      const start = (page - 1) * pageSize;
      const paginated = items.slice(start, start + pageSize);

      return { flags: paginated, total, page, pageSize };
    }
  }

  public async delete(id: string, tenantId: string): Promise<boolean> {
    if (this.pool && typeof this.pool.connect === 'function') {
      const client = await this.pool.connect();
      try {
        await client.query("SELECT set_config('app.current_tenant_id', $1, true)", [tenantId]);
        const res = await client.query('DELETE FROM feature_flags WHERE id = $1 AND tenant_id = $2', [id, tenantId]);
        return (res.rowCount ?? 0) > 0;
      } finally {
        client.release();
      }
    } else {
      const key = `${tenantId}:${id}`;
      return this.inMemoryDb.delete(key);
    }
  }

  private mapToAggregate(row: any): FeatureFlagAggregate {
    const targetRules = typeof row.target_rules === 'string' ? JSON.parse(row.target_rules) : (row.target_rules ?? []);
    return new FeatureFlagAggregate({
      id: row.id,
      tenantId: row.tenant_id,
      flagKey: row.flag_key,
      description: row.description ?? '',
      strategy: row.strategy as FlagStrategy,
      enabled: row.enabled,
      rolloutPercentage: row.rollout_percentage,
      targetRules,
      status: row.status as FlagStatus,
      version: row.version,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    });
  }
}
