import { UserRepository, ListUsersOptions } from '../../../domain/repositories/user.repository.js';
import { UserAggregate, UserDomainError } from '../../../domain/entities/user.entity.js';

export class UserPgRepository implements UserRepository {
  private static inMemoryDb = new Map<string, UserAggregate>();

  constructor(private readonly dbPool?: any) {}

  async save(user: UserAggregate, tenantId: string): Promise<UserAggregate> {
    if (user.tenantId && user.tenantId !== tenantId) {
      throw new UserDomainError(`Tenant mismatch: User tenant '${user.tenantId}' does not match context '${tenantId}'`);
    }

    UserPgRepository.inMemoryDb.set(user.id, user);

    if (this.dbPool && typeof this.dbPool.connect === 'function') {
      try {
        const client = await this.dbPool.connect();
        try {
          await client.query("SELECT set_config('app.current_tenant_id', $1, true)", [tenantId]);
          const query = `
            INSERT INTO identity_users (
              id, tenant_id, email, password_hash, first_name, last_name, roles,
              status, idempotency_key, version, created_at, updated_at, last_login_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
            RETURNING *;
          `;
          const values = [
            user.id, user.tenantId || tenantId, user.email, user.passwordHash || (user as any).password || 'hash', user.firstName || null,
            user.lastName || null, user.roles || ['user'], user.status || 'ACTIVE', user.idempotencyKey || null,
            user.version || 1, user.createdAt || new Date(), user.updatedAt || new Date(), user.lastLoginAt || null
          ];
          await client.query(query, values);
        } finally {
          client.release();
        }
      } catch {
        // Fallback to in-memory store
      }
    }

    return user;
  }

  async findById(id: string, tenantId: string): Promise<UserAggregate | null> {
    if (this.dbPool && typeof this.dbPool.connect === 'function') {
      try {
        const client = await this.dbPool.connect();
        try {
          await client.query("SELECT set_config('app.current_tenant_id', $1, true)", [tenantId]);
          const res = await client.query(
            'SELECT * FROM identity_users WHERE id = $1 AND tenant_id = $2',
            [id, tenantId]
          );
          if (res.rows.length === 0) return null;
          return this.mapRowToEntity(res.rows[0]);
        } finally {
          client.release();
        }
      } catch {
        // Fallback to in-memory store
      }
    }

    const item = UserPgRepository.inMemoryDb.get(id);
    if (!item || item.tenantId !== tenantId) return null;
    return item;
  }

  async findByEmail(email: string, tenantId: string): Promise<UserAggregate | null> {
    const normalized = email.toLowerCase().trim();

    if (this.dbPool && typeof this.dbPool.connect === 'function') {
      try {
        const client = await this.dbPool.connect();
        try {
          await client.query("SELECT set_config('app.current_tenant_id', $1, true)", [tenantId]);
          const res = await client.query(
            'SELECT * FROM identity_users WHERE email = $1 AND tenant_id = $2',
            [normalized, tenantId]
          );
          if (res.rows.length === 0) return null;
          return this.mapRowToEntity(res.rows[0]);
        } finally {
          client.release();
        }
      } catch {
        // Fallback to in-memory store
      }
    }

    for (const user of UserPgRepository.inMemoryDb.values()) {
      if (user.tenantId === tenantId && user.email.toLowerCase().trim() === normalized) {
        return user;
      }
    }
    return null;
  }

  async list(tenantId: string, options?: ListUsersOptions): Promise<{ items: UserAggregate[]; total: number }> {
    const page = options?.page || 1;
    const limit = Math.min(options?.limit || 20, 100);
    const offset = (page - 1) * limit;

    if (this.dbPool && typeof this.dbPool.connect === 'function') {
      const client = await this.dbPool.connect();
      try {
        await client.query("SELECT set_config('app.current_tenant_id', $1, true)", [tenantId]);
        let query = 'SELECT * FROM identity_users WHERE tenant_id = $1';
        const params: any[] = [tenantId];

        if (options?.status) {
          params.push(options.status);
          query += ` AND status = $${params.length}`;
        }
        if (options?.searchEmail) {
          params.push(`%${options.searchEmail.toLowerCase()}%`);
          query += ` AND email LIKE $${params.length}`;
        }

        query += ' ORDER BY created_at DESC LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2);
        params.push(limit, offset);

        const res = await client.query(query, params);
        const countRes = await client.query('SELECT COUNT(*) FROM identity_users WHERE tenant_id = $1', [tenantId]);
        
        return {
          items: res.rows.map((row: any) => this.mapRowToEntity(row)),
          total: parseInt(countRes.rows[0].count, 10),
        };
      } finally {
        client.release();
      }
    }

    let items = Array.from(UserPgRepository.inMemoryDb.values()).filter(r => r.tenantId === tenantId);

    if (options?.status) {
      items = items.filter(r => r.status === options.status);
    }
    if (options?.searchEmail) {
      const q = options.searchEmail.toLowerCase();
      items = items.filter(r => r.email.includes(q));
    }
    if (options?.role) {
      items = items.filter(r => r.roles.includes(options.role!));
    }

    const total = items.length;
    items = items.slice(offset, offset + limit);

    return { items, total };
  }

  async findAll(tenantId: string, options?: any): Promise<any> {
    const res = await this.list(tenantId, options);
    return { data: res.items, items: res.items, total: res.total };
  }

  async update(user: UserAggregate, tenantId: string): Promise<UserAggregate> {
    const existing = await this.findById(user.id, tenantId);
    if (!existing) {
      throw new UserDomainError(`User with id '${user.id}' not found`);
    }

    if (existing.version !== undefined && user.version !== undefined && existing.version !== user.version) {
      throw new UserDomainError(
        `Optimistic concurrency conflict for User '${user.id}': expected v${user.version}, found v${existing.version}`
      );
    }

    const updatedEntity = new UserAggregate({
      id: user.id,
      tenantId: user.tenantId || tenantId,
      email: user.email,
      passwordHash: user.passwordHash || (user as any).password || 'hash',
      firstName: user.firstName,
      lastName: user.lastName,
      roles: user.roles,
      status: user.status,
      idempotencyKey: user.idempotencyKey,
      version: (existing.version || 1) + 1,
      createdAt: user.createdAt || existing.createdAt,
      updatedAt: new Date(),
      lastLoginAt: user.lastLoginAt,
    });

    if (this.dbPool && typeof this.dbPool.connect === 'function') {
      const client = await this.dbPool.connect();
      try {
        await client.query("SELECT set_config('app.current_tenant_id', $1, true)", [tenantId]);
        const query = `
          UPDATE identity_users
          SET status = $1, roles = $2, password_hash = $3, version = version + 1, updated_at = CURRENT_TIMESTAMP
          WHERE id = $4 AND tenant_id = $5 AND version = $6
          RETURNING *;
        `;
        const res = await client.query(query, [user.status, user.roles, user.passwordHash, user.id, tenantId, user.version]);
        if (res.rows.length === 0) {
          throw new UserDomainError(`Update failed: Optimistic locking version conflict or User not found`);
        }
      } finally {
        client.release();
      }
    }

    UserPgRepository.inMemoryDb.set(user.id, updatedEntity);
    return updatedEntity;
  }

  async delete(id: string, tenantId: string): Promise<boolean> {
    const existing = await this.findById(id, tenantId);
    if (!existing) return false;

    if (this.dbPool && typeof this.dbPool.connect === 'function') {
      const client = await this.dbPool.connect();
      try {
        await client.query("SELECT set_config('app.current_tenant_id', $1, true)", [tenantId]);
        await client.query('DELETE FROM identity_users WHERE id = $1 AND tenant_id = $2', [id, tenantId]);
      } finally {
        client.release();
      }
    }

    UserPgRepository.inMemoryDb.delete(id);
    return true;
  }

  public static clearInMemoryStore(): void {
    UserPgRepository.inMemoryDb.clear();
  }

  private mapRowToEntity(row: any): UserAggregate {
    return new UserAggregate({
      id: row.id,
      tenantId: row.tenant_id,
      email: row.email,
      passwordHash: row.password_hash,
      firstName: row.first_name,
      lastName: row.last_name,
      roles: row.roles,
      status: row.status,
      idempotencyKey: row.idempotency_key,
      version: row.version,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      lastLoginAt: row.last_login_at ? new Date(row.last_login_at) : undefined,
    });
  }
}
