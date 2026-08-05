import { ConfigEntryAggregate, ConfigDataType, ConfigStatus } from '../../../domain/entities/config_entry.entity.js';
import { ConfigEntryFilter, ConfigEntryRepository } from '../../../domain/repositories/config_entry.repository.js';

export class ConfigEntryPgRepository implements ConfigEntryRepository {
  private inMemoryDb: Map<string, ConfigEntryAggregate>;

  constructor(
    private readonly pool?: any,
    sharedStore?: Map<string, ConfigEntryAggregate>
  ) {
    this.inMemoryDb = sharedStore ?? new Map<string, ConfigEntryAggregate>();
  }

  public async save(entry: ConfigEntryAggregate): Promise<ConfigEntryAggregate> {
    if (this.pool && typeof this.pool.connect === 'function') {
      const client = await this.pool.connect();
      try {
        await client.query("SELECT set_config('app.current_tenant_id', $1, true)", [entry.tenantId]);
        
        const existing = await client.query(
          'SELECT version FROM config_entries WHERE id = $1 AND tenant_id = $2',
          [entry.id, entry.tenantId]
        );

        if (existing.rows.length > 0) {
          const currentVersion = existing.rows[0].version;
          if (currentVersion !== entry.version - 1) {
            throw new Error(`Optimistic locking failure: expected version ${entry.version - 1}, found ${currentVersion}`);
          }
          await client.query(
            `UPDATE config_entries 
             SET config_key = $1, config_value = $2, data_type = $3, status = $4, is_encrypted = $5, version = $6, updated_at = NOW()
             WHERE id = $7 AND tenant_id = $8`,
            [
              entry.configKey,
              entry.configValue,
              entry.dataType,
              entry.status,
              entry.isEncrypted,
              entry.version,
              entry.id,
              entry.tenantId
            ]
          );
        } else {
          await client.query(
            `INSERT INTO config_entries (id, tenant_id, config_key, config_value, data_type, status, is_encrypted, version, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
            [
              entry.id,
              entry.tenantId,
              entry.configKey,
              entry.configValue,
              entry.dataType,
              entry.status,
              entry.isEncrypted,
              entry.version,
              entry.createdAt,
              entry.updatedAt
            ]
          );
        }
      } finally {
        client.release();
      }
    } else {
      const key = `${entry.tenantId}:${entry.id}`;
      this.inMemoryDb.set(key, entry);
    }
    return entry;
  }

  public async findById(id: string, tenantId: string): Promise<ConfigEntryAggregate | null> {
    if (this.pool && typeof this.pool.connect === 'function') {
      const client = await this.pool.connect();
      try {
        await client.query("SELECT set_config('app.current_tenant_id', $1, true)", [tenantId]);
        const res = await client.query(
          'SELECT * FROM config_entries WHERE id = $1 AND tenant_id = $2',
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

  public async findByKey(configKey: string, tenantId: string): Promise<ConfigEntryAggregate | null> {
    if (this.pool && typeof this.pool.connect === 'function') {
      const client = await this.pool.connect();
      try {
        await client.query("SELECT set_config('app.current_tenant_id', $1, true)", [tenantId]);
        const res = await client.query(
          'SELECT * FROM config_entries WHERE config_key = $1 AND tenant_id = $2',
          [configKey, tenantId]
        );
        if (res.rows.length === 0) return null;
        return this.mapToAggregate(res.rows[0]);
      } finally {
        client.release();
      }
    } else {
      const target = Array.from(this.inMemoryDb.values()).find(
        item => item.tenantId === tenantId && item.configKey === configKey
      );
      return target ?? null;
    }
  }

  public async findAll(filter: ConfigEntryFilter): Promise<{ entries: ConfigEntryAggregate[]; total: number; page: number; pageSize: number }> {
    const page = filter.page ?? 1;
    const pageSize = filter.pageSize ?? 20;

    if (this.pool && typeof this.pool.connect === 'function') {
      const client = await this.pool.connect();
      try {
        await client.query("SELECT set_config('app.current_tenant_id', $1, true)", [filter.tenantId]);
        
        let query = 'SELECT * FROM config_entries WHERE tenant_id = $1';
        let countQuery = 'SELECT COUNT(*) FROM config_entries WHERE tenant_id = $1';
        const params: any[] = [filter.tenantId];
        let paramIdx = 2;

        if (filter.configKey) {
          query += ` AND config_key ILIKE $${paramIdx}`;
          countQuery += ` AND config_key ILIKE $${paramIdx}`;
          params.push(`%${filter.configKey}%`);
          paramIdx++;
        }
        if (filter.dataType) {
          query += ` AND data_type = $${paramIdx}`;
          countQuery += ` AND data_type = $${paramIdx}`;
          params.push(filter.dataType);
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

        const sortBy = filter.sortBy === 'configKey' ? 'config_key' : 'created_at';
        const sortOrder = filter.sortOrder === 'asc' ? 'ASC' : 'DESC';
        query += ` ORDER BY ${sortBy} ${sortOrder} LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`;
        params.push(pageSize, (page - 1) * pageSize);

        const res = await client.query(query, params);
        const entries = res.rows.map((r: any) => this.mapToAggregate(r));

        return { entries, total, page, pageSize };
      } finally {
        client.release();
      }
    } else {
      let items = Array.from(this.inMemoryDb.values()).filter(item => item.tenantId === filter.tenantId);

      if (filter.configKey) {
        const q = filter.configKey.toLowerCase();
        items = items.filter(i => i.configKey.toLowerCase().includes(q));
      }
      if (filter.dataType) {
        items = items.filter(i => i.dataType === filter.dataType);
      }
      if (filter.status) {
        items = items.filter(i => i.status === filter.status);
      }

      const total = items.length;
      items.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

      const start = (page - 1) * pageSize;
      const paginated = items.slice(start, start + pageSize);

      return { entries: paginated, total, page, pageSize };
    }
  }

  public async delete(id: string, tenantId: string): Promise<boolean> {
    if (this.pool && typeof this.pool.connect === 'function') {
      const client = await this.pool.connect();
      try {
        await client.query("SELECT set_config('app.current_tenant_id', $1, true)", [tenantId]);
        const res = await client.query('DELETE FROM config_entries WHERE id = $1 AND tenant_id = $2', [id, tenantId]);
        return (res.rowCount ?? 0) > 0;
      } finally {
        client.release();
      }
    } else {
      const key = `${tenantId}:${id}`;
      return this.inMemoryDb.delete(key);
    }
  }

  private mapToAggregate(row: any): ConfigEntryAggregate {
    return new ConfigEntryAggregate({
      id: row.id,
      tenantId: row.tenant_id,
      configKey: row.config_key,
      configValue: row.config_value,
      dataType: row.data_type as ConfigDataType,
      status: row.status as ConfigStatus,
      isEncrypted: row.is_encrypted,
      version: row.version,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    });
  }
}
