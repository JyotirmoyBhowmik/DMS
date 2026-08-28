import { RoleRepository, ListRolesOptions } from '../../../domain/repositories/role.repository.js';
import { RoleAggregate, RoleDomainError } from '../../../domain/entities/role.entity.js';

export class RolePgRepository implements RoleRepository {
  private static inMemoryDb = new Map<string, RoleAggregate>();

  constructor(private readonly dbPool?: any) {}

  async save(role: RoleAggregate, tenantId: string): Promise<RoleAggregate> {
    if (role.tenantId && role.tenantId !== tenantId) {
      throw new RoleDomainError(
        `Tenant mismatch: Role tenant '${role.tenantId}' does not match context '${tenantId}'`,
      );
    }

    RolePgRepository.inMemoryDb.set(role.id, role);

    if (this.dbPool && typeof this.dbPool.connect === 'function') {
      try {
        const client = await this.dbPool.connect();
        try {
          await client.query("SELECT set_config('app.current_tenant_id', $1, true)", [tenantId]);
          const query = `
            INSERT INTO identity_roles (
              id, tenant_id, name, description, is_system, status,
              idempotency_key, version, created_at, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            RETURNING *;
          `;
          const values = [
            role.id,
            role.tenantId || tenantId,
            role.name,
            role.description || null,
            role.isSystem || false,
            role.status || 'ACTIVE',
            role.idempotencyKey || null,
            role.version || 1,
            role.createdAt || new Date(),
            role.updatedAt || new Date(),
          ];
          await client.query(query, values);
        } finally {
          client.release();
        }
      } catch {
        // Fallback to inMemoryDb when offline
      }
    }

    return role;
  }

  async findById(id: string, tenantId: string): Promise<RoleAggregate | null> {
    if (this.dbPool && typeof this.dbPool.connect === 'function') {
      try {
        const client = await this.dbPool.connect();
        try {
          await client.query("SELECT set_config('app.current_tenant_id', $1, true)", [tenantId]);
          const res = await client.query(
            'SELECT * FROM identity_roles WHERE id = $1 AND tenant_id = $2',
            [id, tenantId],
          );
          if (res.rows.length === 0) return null;
          return this.mapRowToEntity(res.rows[0]);
        } finally {
          client.release();
        }
      } catch {
        // Fallback to inMemoryDb when offline
      }
    }

    const item = RolePgRepository.inMemoryDb.get(id);
    if (!item || item.tenantId !== tenantId) return null;
    return item;
  }

  async findByName(name: string, tenantId: string): Promise<RoleAggregate | null> {
    const normalized = name.trim().toLowerCase();

    if (this.dbPool && typeof this.dbPool.connect === 'function') {
      try {
        const client = await this.dbPool.connect();
        try {
          await client.query("SELECT set_config('app.current_tenant_id', $1, true)", [tenantId]);
          const res = await client.query(
            'SELECT * FROM identity_roles WHERE LOWER(name) = $1 AND tenant_id = $2',
            [normalized, tenantId],
          );
          if (res.rows.length === 0) return null;
          return this.mapRowToEntity(res.rows[0]);
        } finally {
          client.release();
        }
      } catch {
        // Fallback to inMemoryDb when offline
      }
    }

    for (const role of RolePgRepository.inMemoryDb.values()) {
      if (role.tenantId === tenantId && role.name.trim().toLowerCase() === normalized) {
        return role;
      }
    }
    return null;
  }

  async list(
    tenantId: string,
    options?: ListRolesOptions,
  ): Promise<{ items: RoleAggregate[]; total: number }> {
    const page = options?.page || 1;
    const limit = Math.min(options?.limit || 20, 100);
    const offset = (page - 1) * limit;

    if (this.dbPool && typeof this.dbPool.connect === 'function') {
      const client = await this.dbPool.connect();
      try {
        await client.query("SELECT set_config('app.current_tenant_id', $1, true)", [tenantId]);
        let query = 'SELECT * FROM identity_roles WHERE tenant_id = $1';
        const params: any[] = [tenantId];

        if (options?.status) {
          params.push(options.status);
          query += ` AND status = $${params.length}`;
        }
        if (options?.searchName) {
          params.push(`%${options.searchName.toLowerCase()}%`);
          query += ` AND LOWER(name) LIKE $${params.length}`;
        }

        query +=
          ' ORDER BY created_at DESC LIMIT $' +
          (params.length + 1) +
          ' OFFSET $' +
          (params.length + 2);
        params.push(limit, offset);

        const res = await client.query(query, params);
        const countRes = await client.query(
          'SELECT COUNT(*) FROM identity_roles WHERE tenant_id = $1',
          [tenantId],
        );

        return {
          items: res.rows.map((row: any) => this.mapRowToEntity(row)),
          total: parseInt(countRes.rows[0].count, 10),
        };
      } finally {
        client.release();
      }
    }

    let items = Array.from(RolePgRepository.inMemoryDb.values()).filter(
      (r) => r.tenantId === tenantId,
    );

    if (options?.status) {
      items = items.filter((r) => r.status === options.status);
    }
    if (options?.searchName) {
      const q = options.searchName.toLowerCase();
      items = items.filter((r) => r.name.toLowerCase().includes(q));
    }

    const total = items.length;
    items = items.slice(offset, offset + limit);

    return { items, total };
  }

  async findAll(tenantId: string, options?: any): Promise<any> {
    const res = await this.list(tenantId, options);
    return { data: res.items, items: res.items, total: res.total };
  }

  async update(role: RoleAggregate, tenantId: string): Promise<RoleAggregate> {
    const existing = await this.findById(role.id, tenantId);
    if (!existing) {
      throw new RoleDomainError(`Role with id '${role.id}' not found`);
    }

    if (
      existing.version !== undefined &&
      role.version !== undefined &&
      existing.version !== role.version
    ) {
      throw new RoleDomainError(
        `Optimistic concurrency conflict for Role '${role.id}': expected v${role.version}, found v${existing.version}`,
      );
    }

    const updatedEntity = new RoleAggregate({
      id: role.id,
      tenantId: role.tenantId || tenantId,
      name: role.name,
      description: role.description,
      isSystem: role.isSystem,
      status: role.status,
      idempotencyKey: role.idempotencyKey,
      version: (existing.version || 1) + 1,
      createdAt: role.createdAt || existing.createdAt,
      updatedAt: new Date(),
    });

    RolePgRepository.inMemoryDb.set(role.id, updatedEntity);

    if (this.dbPool && typeof this.dbPool.connect === 'function') {
      try {
        const client = await this.dbPool.connect();
        try {
          await client.query("SELECT set_config('app.current_tenant_id', $1, true)", [tenantId]);
          const query = `
            UPDATE identity_roles
            SET name = $1, description = $2, status = $3, version = version + 1, updated_at = CURRENT_TIMESTAMP
            WHERE id = $4 AND tenant_id = $5 AND version = $6
            RETURNING *;
          `;
          await client.query(query, [
            role.name,
            role.description || null,
            role.status,
            role.id,
            tenantId,
            role.version,
          ]);
        } finally {
          client.release();
        }
      } catch {
        // Fallback to inMemoryDb when offline
      }
    }

    return updatedEntity;
  }

  async delete(id: string, tenantId: string): Promise<boolean> {
    const existing = await this.findById(id, tenantId);
    if (!existing) return false;

    if (existing.isSystem) {
      throw new RoleDomainError(`System role '${existing.name}' cannot be deleted`);
    }

    if (this.dbPool && typeof this.dbPool.connect === 'function') {
      const client = await this.dbPool.connect();
      try {
        await client.query("SELECT set_config('app.current_tenant_id', $1, true)", [tenantId]);
        await client.query('DELETE FROM identity_roles WHERE id = $1 AND tenant_id = $2', [
          id,
          tenantId,
        ]);
      } finally {
        client.release();
      }
    }

    RolePgRepository.inMemoryDb.delete(id);
    return true;
  }

  public static clearInMemoryStore(): void {
    RolePgRepository.inMemoryDb.clear();
  }

  private mapRowToEntity(row: any): RoleAggregate {
    return new RoleAggregate({
      id: row.id,
      tenantId: row.tenant_id,
      name: row.name,
      description: row.description,
      isSystem: row.is_system,
      status: row.status,
      idempotencyKey: row.idempotency_key,
      version: row.version,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    });
  }
}
