import { PermissionRepository, ListPermissionsOptions } from '../../../domain/repositories/permission.repository.js';
import { PermissionAggregate, PermissionDomainError } from '../../../domain/entities/permission.entity.js';

export class PermissionPgRepository implements PermissionRepository {
  private static globalInMemoryDb = new Map<string, PermissionAggregate>();
  private inMemoryDb: Map<string, PermissionAggregate>;

  constructor(private readonly dbPool?: any, sharedStore?: Map<string, PermissionAggregate>) {
    this.inMemoryDb = sharedStore || PermissionPgRepository.globalInMemoryDb;
  }

  async save(permission: PermissionAggregate, tenantId: string): Promise<PermissionAggregate> {
    if (permission.tenantId && permission.tenantId !== tenantId && permission.tenantId !== 'global') {
      throw new PermissionDomainError(`Tenant mismatch: Permission tenant '${permission.tenantId}' does not match context '${tenantId}'`);
    }

    if (this.dbPool && typeof this.dbPool.connect === 'function') {
      const client = await this.dbPool.connect();
      try {
        await client.query("SELECT set_config('app.current_tenant_id', $1, true)", [tenantId]);
        const query = `
          INSERT INTO identity_permissions (
            id, tenant_id, name, resource, action, description, status,
            idempotency_key, version, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
          RETURNING *;
        `;
        const values = [
          permission.id, permission.tenantId || tenantId, permission.name, permission.resource, permission.action,
          permission.description || null, permission.status || 'ACTIVE', permission.idempotencyKey || null,
          permission.version || 1, permission.createdAt || new Date(), permission.updatedAt || new Date()
        ];
        await client.query(query, values);
      } finally {
        client.release();
      }
    }

    this.inMemoryDb.set(permission.id, permission);
    return permission;
  }

  async findById(id: string, tenantId: string): Promise<PermissionAggregate | null> {
    if (this.dbPool && typeof this.dbPool.connect === 'function') {
      const client = await this.dbPool.connect();
      try {
        await client.query("SELECT set_config('app.current_tenant_id', $1, true)", [tenantId]);
        const res = await client.query(
          'SELECT * FROM identity_permissions WHERE id = $1 AND tenant_id = $2',
          [id, tenantId]
        );
        if (res.rows.length === 0) return null;
        return this.mapRowToEntity(res.rows[0]);
      } finally {
        client.release();
      }
    }

    const item = this.inMemoryDb.get(id);
    if (!item || (item.tenantId !== tenantId && item.tenantId !== 'global')) return null;
    return item;
  }

  async findByName(name: string, tenantId: string): Promise<PermissionAggregate | null> {
    const normalized = name.trim().toLowerCase();

    if (this.dbPool && typeof this.dbPool.connect === 'function') {
      const client = await this.dbPool.connect();
      try {
        await client.query("SELECT set_config('app.current_tenant_id', $1, true)", [tenantId]);
        const res = await client.query(
          'SELECT * FROM identity_permissions WHERE LOWER(name) = $1 AND (tenant_id = $2 OR tenant_id = \'global\')',
          [normalized, tenantId]
        );
        if (res.rows.length === 0) return null;
        return this.mapRowToEntity(res.rows[0]);
      } finally {
        client.release();
      }
    }

    for (const perm of this.inMemoryDb.values()) {
      if ((perm.tenantId === tenantId || perm.tenantId === 'global') && perm.name.trim().toLowerCase() === normalized) {
        return perm;
      }
    }
    return null;
  }

  async list(tenantId: string, options?: ListPermissionsOptions): Promise<{ items: PermissionAggregate[]; total: number }> {
    const page = options?.page || 1;
    const limit = Math.min(options?.limit || 20, 100);
    const offset = (page - 1) * limit;

    if (this.dbPool && typeof this.dbPool.connect === 'function') {
      const client = await this.dbPool.connect();
      try {
        await client.query("SELECT set_config('app.current_tenant_id', $1, true)", [tenantId]);
        let query = 'SELECT * FROM identity_permissions WHERE tenant_id = $1';
        const params: any[] = [tenantId];

        if (options?.status) {
          params.push(options.status);
          query += ` AND status = $${params.length}`;
        }
        if (options?.resource) {
          params.push(options.resource);
          query += ` AND resource = $${params.length}`;
        }
        if (options?.searchName) {
          params.push(`%${options.searchName.toLowerCase()}%`);
          query += ` AND LOWER(name) LIKE $${params.length}`;
        }

        query += ' ORDER BY created_at DESC LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2);
        params.push(limit, offset);

        const res = await client.query(query, params);
        const countRes = await client.query('SELECT COUNT(*) FROM identity_permissions WHERE tenant_id = $1', [tenantId]);
        
        return {
          items: res.rows.map((row: any) => this.mapRowToEntity(row)),
          total: parseInt(countRes.rows[0].count, 10),
        };
      } finally {
        client.release();
      }
    }

    let items = Array.from(this.inMemoryDb.values()).filter(p => p.tenantId === tenantId || p.tenantId === 'global');

    if (options?.status) {
      items = items.filter(p => p.status === options.status);
    }
    if (options?.resource) {
      items = items.filter(p => p.resource === options.resource);
    }
    if (options?.searchName) {
      const q = options.searchName.toLowerCase();
      items = items.filter(p => p.name.toLowerCase().includes(q));
    }

    const total = items.length;
    items = items.slice(offset, offset + limit);

    return { items, total };
  }

  async findAll(tenantId: string, options?: any): Promise<any> {
    const res = await this.list(tenantId, options);
    return { data: res.items, items: res.items, total: res.total };
  }

  async update(permission: PermissionAggregate, tenantId: string): Promise<PermissionAggregate> {
    const existing = await this.findById(permission.id, tenantId);
    if (!existing) {
      throw new PermissionDomainError(`Permission with id '${permission.id}' not found`);
    }

    if (existing.version !== undefined && permission.version !== undefined && existing.version !== permission.version) {
      throw new PermissionDomainError(
        `Optimistic concurrency conflict for Permission '${permission.id}': expected v${permission.version}, found v${existing.version}`
      );
    }

    const updatedEntity = new PermissionAggregate({
      id: permission.id,
      tenantId: permission.tenantId || tenantId,
      name: permission.name,
      resource: permission.resource,
      action: permission.action,
      description: permission.description,
      status: permission.status,
      idempotencyKey: permission.idempotencyKey,
      version: (existing.version || 1) + 1,
      createdAt: permission.createdAt || existing.createdAt,
      updatedAt: new Date(),
    });

    if (this.dbPool && typeof this.dbPool.connect === 'function') {
      const client = await this.dbPool.connect();
      try {
        await client.query("SELECT set_config('app.current_tenant_id', $1, true)", [tenantId]);
        const query = `
          UPDATE identity_permissions
          SET name = $1, resource = $2, action = $3, description = $4, status = $5, version = version + 1, updated_at = CURRENT_TIMESTAMP
          WHERE id = $6 AND tenant_id = $7 AND version = $8
          RETURNING *;
        `;
        const res = await client.query(query, [permission.name, permission.resource, permission.action, permission.description || null, permission.status, permission.id, tenantId, permission.version]);
        if (res.rows.length === 0) {
          throw new PermissionDomainError(`Update failed: Optimistic locking version conflict or Permission not found`);
        }
      } finally {
        client.release();
      }
    }

    this.inMemoryDb.set(permission.id, updatedEntity);
    return updatedEntity;
  }

  async delete(id: string, tenantId: string): Promise<boolean> {
    const existing = await this.findById(id, tenantId);
    if (!existing) return false;

    if (this.dbPool && typeof this.dbPool.connect === 'function') {
      const client = await this.dbPool.connect();
      try {
        await client.query("SELECT set_config('app.current_tenant_id', $1, true)", [tenantId]);
        await client.query('DELETE FROM identity_permissions WHERE id = $1 AND tenant_id = $2', [id, tenantId]);
      } finally {
        client.release();
      }
    }

    this.inMemoryDb.delete(id);
    return true;
  }

  public static clearInMemoryStore(): void {
    PermissionPgRepository.globalInMemoryDb.clear();
  }

  private mapRowToEntity(row: any): PermissionAggregate {
    return new PermissionAggregate({
      id: row.id,
      tenantId: row.tenant_id,
      name: row.name,
      resource: row.resource,
      action: row.action,
      description: row.description,
      status: row.status,
      idempotencyKey: row.idempotency_key,
      version: row.version,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    });
  }
}
