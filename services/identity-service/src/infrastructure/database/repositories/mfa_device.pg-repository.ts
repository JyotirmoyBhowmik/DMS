import { MFADeviceRepository, ListMFADevicesOptions } from '../../../domain/repositories/mfa_device.repository.js';
import { MFADeviceAggregate, MFADeviceDomainError } from '../../../domain/entities/mfa_device.entity.js';

export class MFADevicePgRepository implements MFADeviceRepository {
  private static globalInMemoryDb = new Map<string, MFADeviceAggregate>();
  private inMemoryDb: Map<string, MFADeviceAggregate>;

  constructor(private readonly dbPool?: any, sharedStore?: Map<string, MFADeviceAggregate>) {
    this.inMemoryDb = sharedStore || MFADevicePgRepository.globalInMemoryDb;
  }

  async save(mfaDevice: MFADeviceAggregate, tenantId: string): Promise<MFADeviceAggregate> {
    if (mfaDevice.tenantId !== tenantId) {
      throw new MFADeviceDomainError(`Tenant mismatch: MFADevice tenant '${mfaDevice.tenantId}' does not match context '${tenantId}'`);
    }

    this.inMemoryDb.set(mfaDevice.id, mfaDevice);

    if (this.dbPool && typeof this.dbPool.connect === 'function') {
      try {
        const client = await this.dbPool.connect();
        try {
          await client.query("SELECT set_config('app.current_tenant_id', $1, true)", [tenantId]);
          const query = `
            INSERT INTO identity_mfa_devices (
              id, tenant_id, user_id, type, secret_encrypted, is_active,
              last_used_at, version, created_at, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            RETURNING *;
          `;
          const values = [
            mfaDevice.id, mfaDevice.tenantId, mfaDevice.userId, mfaDevice.type,
            mfaDevice.secretEncrypted, mfaDevice.isActive, mfaDevice.lastUsedAt,
            mfaDevice.version, mfaDevice.createdAt, mfaDevice.updatedAt
          ];
          await client.query(query, values);
        } finally {
          client.release();
        }
      } catch {
        // Fallback to inMemoryDb when offline
      }
    }

    return mfaDevice;
  }

  async findById(id: string, tenantId: string): Promise<MFADeviceAggregate | null> {
    if (this.dbPool && typeof this.dbPool.connect === 'function') {
      const client = await this.dbPool.connect();
      try {
        await client.query("SELECT set_config('app.current_tenant_id', $1, true)", [tenantId]);
        const res = await client.query(
          'SELECT * FROM identity_mfa_devices WHERE id = $1 AND tenant_id = $2',
          [id, tenantId]
        );
        if (res.rows.length === 0) return null;
        return this.mapRowToEntity(res.rows[0]);
      } finally {
        client.release();
      }
    }

    const item = this.inMemoryDb.get(id);
    if (!item || item.tenantId !== tenantId) return null;
    return item;
  }

  async findByUserAndType(userId: string, type: any, tenantId: string): Promise<MFADeviceAggregate | null> {
    if (this.dbPool && typeof this.dbPool.connect === 'function') {
      const client = await this.dbPool.connect();
      try {
        await client.query("SELECT set_config('app.current_tenant_id', $1, true)", [tenantId]);
        const res = await client.query(
          'SELECT * FROM identity_mfa_devices WHERE user_id = $1 AND type = $2 AND tenant_id = $3',
          [userId, type, tenantId]
        );
        if (res.rows.length === 0) return null;
        return this.mapRowToEntity(res.rows[0]);
      } finally {
        client.release();
      }
    }

    for (const item of this.inMemoryDb.values()) {
      if (item.tenantId === tenantId && item.userId === userId && item.type === type) {
        return item;
      }
    }
    return null;
  }

  async list(tenantId: string, options?: ListMFADevicesOptions): Promise<{ items: MFADeviceAggregate[]; total: number }> {
    const page = Math.max(1, options?.page || 1);
    const limit = Math.min(100, Math.max(1, options?.limit || 20));
    const offset = (page - 1) * limit;

    if (this.dbPool && typeof this.dbPool.connect === 'function') {
      const client = await this.dbPool.connect();
      try {
        await client.query("SELECT set_config('app.current_tenant_id', $1, true)", [tenantId]);
        const whereClauses = ['tenant_id = $1'];
        const values: any[] = [tenantId];

        if (options?.type) {
          values.push(options.type);
          whereClauses.push(`type = $${values.length}`);
        }
        if (options?.isActive !== undefined) {
          values.push(options.isActive);
          whereClauses.push(`is_active = $${values.length}`);
        }
        if (options?.userId) {
          values.push(options.userId);
          whereClauses.push(`user_id = $${values.length}`);
        }

        const whereStr = whereClauses.join(' AND ');
        const countRes = await client.query(`SELECT COUNT(*)::int FROM identity_mfa_devices WHERE ${whereStr}`, values);
        const total = countRes.rows[0].count;

        values.push(limit, offset);
        const dataRes = await client.query(
          `SELECT * FROM identity_mfa_devices WHERE ${whereStr} ORDER BY created_at DESC LIMIT $${values.length - 1} OFFSET $${values.length}`,
          values
        );
        const items = dataRes.rows.map((row: any) => this.mapRowToEntity(row));
        return { items, total };
      } finally {
        client.release();
      }
    }

    let items = Array.from(this.inMemoryDb.values()).filter(item => item.tenantId === tenantId);

    if (options?.type) {
      items = items.filter(item => item.type === options.type);
    }
    if (options?.isActive !== undefined) {
      items = items.filter(item => item.isActive === options.isActive);
    }
    if (options?.userId) {
      items = items.filter(item => item.userId === options.userId);
    }

    items.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    const total = items.length;
    items = items.slice(offset, offset + limit);

    return { items, total };
  }

  async update(mfaDevice: MFADeviceAggregate, tenantId: string): Promise<MFADeviceAggregate> {
    const existing = await this.findById(mfaDevice.id, tenantId);
    if (!existing) {
      throw new MFADeviceDomainError(`MFADevice with id '${mfaDevice.id}' not found`);
    }

    if (existing.version !== mfaDevice.version) {
      throw new MFADeviceDomainError(
        `Optimistic concurrency conflict for MFADevice '${mfaDevice.id}': expected v${mfaDevice.version}, found v${existing.version}`
      );
    }

    const updatedEntity = new MFADeviceAggregate({
      id: mfaDevice.id,
      tenantId: mfaDevice.tenantId || existing.tenantId,
      userId: mfaDevice.userId || existing.userId,
      type: mfaDevice.type || existing.type,
      secretEncrypted: mfaDevice.secretEncrypted || existing.secretEncrypted,
      isActive: mfaDevice.isActive !== undefined ? mfaDevice.isActive : existing.isActive,
      lastUsedAt: mfaDevice.lastUsedAt || existing.lastUsedAt,
      version: existing.version + 1,
      createdAt: mfaDevice.createdAt || existing.createdAt,
      updatedAt: new Date(),
    });

    if (this.dbPool && typeof this.dbPool.connect === 'function') {
      const client = await this.dbPool.connect();
      try {
        await client.query("SELECT set_config('app.current_tenant_id', $1, true)", [tenantId]);
        const query = `
          UPDATE identity_mfa_devices
          SET secret_encrypted = $1, is_active = $2, last_used_at = $3, version = version + 1, updated_at = CURRENT_TIMESTAMP
          WHERE id = $4 AND tenant_id = $5 AND version = $6
          RETURNING *;
        `;
        const res = await client.query(query, [
          updatedEntity.secretEncrypted, updatedEntity.isActive, updatedEntity.lastUsedAt,
          mfaDevice.id, tenantId, mfaDevice.version
        ]);

        if (res.rows.length === 0) {
          throw new MFADeviceDomainError(`Optimistic concurrency update failed for MFADevice '${mfaDevice.id}'`);
        }
      } finally {
        client.release();
      }
    }

    this.inMemoryDb.set(updatedEntity.id, updatedEntity);
    return updatedEntity;
  }

  async delete(id: string, tenantId: string): Promise<boolean> {
    const existing = await this.findById(id, tenantId);
    if (!existing) return false;

    if (this.dbPool && typeof this.dbPool.connect === 'function') {
      const client = await this.dbPool.connect();
      try {
        await client.query("SELECT set_config('app.current_tenant_id', $1, true)", [tenantId]);
        const res = await client.query('DELETE FROM identity_mfa_devices WHERE id = $1 AND tenant_id = $2', [id, tenantId]);
        this.inMemoryDb.delete(id);
        return (res.rowCount ?? 0) > 0;
      } finally {
        client.release();
      }
    }

    this.inMemoryDb.delete(id);
    return true;
  }

  private mapRowToEntity(row: any): MFADeviceAggregate {
    return new MFADeviceAggregate({
      id: row.id,
      tenantId: row.tenant_id,
      userId: row.user_id,
      type: row.type,
      secretEncrypted: row.secret_encrypted,
      isActive: row.is_active,
      lastUsedAt: row.last_used_at,
      version: row.version,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }
}
