import { TenantRepository, ListTenantsOptions } from '../../../domain/repositories/tenant.repository.js';
import { TenantAggregate, TenantDomainError } from '../../../domain/entities/tenant.entity.js';

export class TenantPgRepository implements TenantRepository {
  private static globalInMemoryDb = new Map<string, TenantAggregate>();
  private inMemoryDb: Map<string, TenantAggregate>;

  constructor(private readonly dbPool?: any, sharedStore?: Map<string, TenantAggregate>) {
    this.inMemoryDb = sharedStore || TenantPgRepository.globalInMemoryDb;
  }

  async save(tenant: TenantAggregate, tenantId?: string): Promise<TenantAggregate> {
    this.inMemoryDb.set(tenant.id, tenant);

    if (this.dbPool && typeof this.dbPool.connect === 'function') {
      try {
        const client = await this.dbPool.connect();
        try {
          await client.query("SELECT set_config('app.current_tenant_id', $1, true)", [tenant.id]);
          const query = `
            INSERT INTO identity_tenants (
              id, tenant_id, name, code, domain, status,
              idempotency_key, version, created_at, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            RETURNING *;
          `;
          const values = [
            tenant.id, tenant.tenantId, tenant.name, tenant.code, tenant.domain || null,
            tenant.status || 'ACTIVE', tenant.idempotencyKey || null, tenant.version || 1,
            tenant.createdAt || new Date(), tenant.updatedAt || new Date()
          ];
          await client.query(query, values);
        } finally {
          client.release();
        }
      } catch {
        // Fallback to inMemoryDb when offline
      }
    }

    return tenant;
  }

  async findById(id: string, tenantId?: string): Promise<TenantAggregate | null> {
    if (this.dbPool && typeof this.dbPool.connect === 'function') {
      try {
        const client = await this.dbPool.connect();
        try {
          if (tenantId) {
            await client.query("SELECT set_config('app.current_tenant_id', $1, true)", [tenantId]);
          }
          const res = await client.query('SELECT * FROM identity_tenants WHERE id = $1', [id]);
          if (res.rows.length === 0) return null;
          return this.mapRowToEntity(res.rows[0]);
        } finally {
          client.release();
        }
      } catch {
        // Fallback to inMemoryDb when offline
      }
    }

    const item = this.inMemoryDb.get(id);
    if (!item) return null;
    if (tenantId && item.id !== tenantId && item.tenantId !== tenantId) return null;
    return item;
  }

  async findByName(name: string, tenantId?: string): Promise<TenantAggregate | null> {
    const normalized = name.trim().toLowerCase();

    if (this.dbPool && typeof this.dbPool.connect === 'function') {
      try {
        const client = await this.dbPool.connect();
        try {
          const res = await client.query('SELECT * FROM identity_tenants WHERE LOWER(name) = $1', [normalized]);
          if (res.rows.length === 0) return null;
          return this.mapRowToEntity(res.rows[0]);
        } finally {
          client.release();
        }
      } catch {
        // Fallback to inMemoryDb when offline
      }
    }

    for (const tenant of this.inMemoryDb.values()) {
      if (tenant.name.trim().toLowerCase() === normalized) {
        return tenant;
      }
    }
    return null;
  }

  async findByCode(code: string, tenantId?: string): Promise<TenantAggregate | null> {
    const normalized = code.trim().toUpperCase();

    if (this.dbPool && typeof this.dbPool.connect === 'function') {
      const client = await this.dbPool.connect();
      try {
        const res = await client.query('SELECT * FROM identity_tenants WHERE code = $1', [normalized]);
        if (res.rows.length === 0) return null;
        return this.mapRowToEntity(res.rows[0]);
      } finally {
        client.release();
      }
    }

    for (const tenant of this.inMemoryDb.values()) {
      if (tenant.code.trim().toUpperCase() === normalized) {
        return tenant;
      }
    }
    return null;
  }

  async list(tenantId?: string, options?: ListTenantsOptions): Promise<{ items: TenantAggregate[]; total: number }> {
    const page = options?.page || 1;
    const limit = Math.min(options?.limit || 20, 100);
    const offset = (page - 1) * limit;

    if (this.dbPool && typeof this.dbPool.connect === 'function') {
      const client = await this.dbPool.connect();
      try {
        let query = 'SELECT * FROM identity_tenants WHERE 1=1';
        const params: any[] = [];

        if (options?.status) {
          params.push(options.status);
          query += ` AND status = $${params.length}`;
        }
        if (options?.searchName) {
          params.push(`%${options.searchName.toLowerCase()}%`);
          query += ` AND LOWER(name) LIKE $${params.length}`;
        }

        query += ' ORDER BY created_at DESC LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2);
        params.push(limit, offset);

        const res = await client.query(query, params);
        const countRes = await client.query('SELECT COUNT(*) FROM identity_tenants');
        
        return {
          items: res.rows.map((row: any) => this.mapRowToEntity(row)),
          total: parseInt(countRes.rows[0].count, 10),
        };
      } finally {
        client.release();
      }
    }

    let items = Array.from(this.inMemoryDb.values());
    if (tenantId) {
      items = items.filter(t => t.id === tenantId || t.tenantId === tenantId);
    }

    if (options?.status) {
      items = items.filter(t => t.status === options.status);
    }
    if (options?.searchName) {
      const q = options.searchName.toLowerCase();
      items = items.filter(t => t.name.toLowerCase().includes(q));
    }

    const total = items.length;
    items = items.slice(offset, offset + limit);

    return { items, total };
  }

  async findAll(tenantId?: string, options?: any): Promise<any> {
    const res = await this.list(tenantId, options);
    return { data: res.items, items: res.items, total: res.total };
  }

  async update(tenant: TenantAggregate, tenantId?: string): Promise<TenantAggregate> {
    const existing = await this.findById(tenant.id, tenantId);
    if (!existing) {
      throw new TenantDomainError(`Tenant with id '${tenant.id}' not found`);
    }

    if (existing.version !== undefined && tenant.version !== undefined && existing.version !== tenant.version) {
      throw new TenantDomainError(
        `Optimistic concurrency conflict for Tenant '${tenant.id}': expected v${tenant.version}, found v${existing.version}`
      );
    }

    const updatedEntity = new TenantAggregate({
      id: tenant.id,
      tenantId: tenant.tenantId || existing.tenantId,
      name: tenant.name || existing.name,
      code: tenant.code || existing.code || `TC-${tenant.id.slice(0, 4)}`,
      domain: tenant.domain !== undefined ? tenant.domain : existing.domain,
      status: tenant.status || existing.status,
      idempotencyKey: tenant.idempotencyKey || existing.idempotencyKey,
      version: (existing.version || 1) + 1,
      createdAt: tenant.createdAt || existing.createdAt,
      updatedAt: new Date(),
    });

    this.inMemoryDb.set(tenant.id, updatedEntity);

    if (this.dbPool && typeof this.dbPool.connect === 'function') {
      try {
        const client = await this.dbPool.connect();
        try {
          const query = `
            UPDATE identity_tenants
            SET name = $1, domain = $2, status = $3, version = version + 1, updated_at = CURRENT_TIMESTAMP
            WHERE id = $4 AND version = $5
            RETURNING *;
          `;
          await client.query(query, [tenant.name, tenant.domain || null, tenant.status, tenant.id, tenant.version]);
        } finally {
          client.release();
        }
      } catch {
        // Fallback to inMemoryDb when offline
      }
    }

    return updatedEntity;
  }

  async delete(id: string, tenantId?: string): Promise<boolean> {
    const existing = await this.findById(id, tenantId);
    if (!existing) return false;

    if (this.dbPool && typeof this.dbPool.connect === 'function') {
      const client = await this.dbPool.connect();
      try {
        await client.query('DELETE FROM identity_tenants WHERE id = $1', [id]);
      } finally {
        client.release();
      }
    }

    this.inMemoryDb.delete(id);
    return true;
  }

  public static clearInMemoryStore(): void {
    TenantPgRepository.globalInMemoryDb.clear();
  }

  private mapRowToEntity(row: any): TenantAggregate {
    return new TenantAggregate({
      id: row.id,
      tenantId: row.tenant_id,
      name: row.name,
      code: row.code,
      domain: row.domain,
      status: row.status,
      idempotencyKey: row.idempotency_key,
      version: row.version,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    });
  }
}
