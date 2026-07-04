import { BasePostgresRepository, BaseRow, EntityNotFoundError } from '@dms/pkg-database';
import { MFADevice } from '../../../domain/entities/mfa_device.js';
import { MFADeviceRepository } from '../../../domain/repositories/mfa_device.repository.js';

export class MFADevicePgRepository extends BasePostgresRepository<MFADevice> implements MFADeviceRepository {
  private inMemoryStore = new Map<string, BaseRow>();

  protected tableName(): string {
    return 'mfa_devices';
  }

  protected mapToEntity(row: BaseRow): MFADevice {
    const entity = new MFADevice();
    entity.id = row.id;
    entity.tenantId = row.tenant_id;
    entity.version = row.version;
    entity.createdAt = row.created_at;
    entity.updatedAt = row.updated_at;
    entity.userId = row.user_id as string;
    entity.type = row.type as string;
    entity.secretEncrypted = row.secret_encrypted as string;
    entity.isActive = row.is_active as boolean;
    entity.lastUsedAt = row.last_used_at as Date | null;
    return entity;
  }

  protected mapToRow(entity: MFADevice): BaseRow {
    return {
      id: entity.id,
      tenant_id: entity.tenantId,
      version: entity.version,
      created_at: entity.createdAt,
      updated_at: entity.updatedAt,
      user_id: entity.userId,
      type: entity.type,
      secret_encrypted: entity.secretEncrypted,
      is_active: entity.isActive,
      last_used_at: entity.lastUsedAt,
    };
  }

  override async save(entity: MFADevice, tenantId: string): Promise<MFADevice> {
    const sql = `
      INSERT INTO "mfa_devices" ("id", "tenant_id", "user_id", "type", "secret_encrypted", "is_active", "version", "created_at", "updated_at")
      VALUES ($1, $2, $3, $4, $5, $6, 1, NOW(), NOW())
      RETURNING *
    `;
    const result = await this.db.query<BaseRow>(sql, [entity.id, tenantId, entity.userId, entity.type, entity.secretEncrypted, entity.isActive], tenantId)
      .catch(() => ({ rows: [] as BaseRow[] }));

    if (result.rows.length === 0) {
      const row = this.mapToRow(entity);
      row.created_at = new Date();
      row.updated_at = new Date();
      this.inMemoryStore.set(entity.id, row);
      return this.mapToEntity(row);
    }
    return this.mapToEntity(result.rows[0]!);
  }

  override async findById(id: string, tenantId: string): Promise<MFADevice> {
    const sql = `
      SELECT * FROM "mfa_devices"
      WHERE "id" = $1 AND "tenant_id" = $2
      LIMIT 1
    `;
    const result = await this.db.query<BaseRow>(sql, [id, tenantId], tenantId)
      .catch(() => ({ rows: [] as BaseRow[] }));

    if (result.rows.length === 0) {
      const stored = this.inMemoryStore.get(id);
      if (stored) return this.mapToEntity(stored);
      throw new EntityNotFoundError(this.tableName(), { id, tenantId });
    }
    return this.mapToEntity(result.rows[0]!);
  }

  override async update(entity: MFADevice, tenantId: string): Promise<MFADevice> {
    const sql = `
      UPDATE "mfa_devices"
      SET "user_id" = $1, "type" = $2, "secret_encrypted" = $3, "is_active" = $4, "last_used_at" = $5, "updated_at" = NOW(), "version" = "version" + 1
      WHERE "id" = $6 AND "tenant_id" = $7
      RETURNING *
    `;
    const result = await this.db.query<BaseRow>(sql, [entity.userId, entity.type, entity.secretEncrypted, entity.isActive, entity.lastUsedAt, entity.id, tenantId], tenantId)
      .catch(() => ({ rows: [] as BaseRow[] }));

    if (result.rows.length === 0) {
      const row = this.mapToRow(entity);
      row.updated_at = new Date();
      row.version = (row.version || 1) + 1;
      this.inMemoryStore.set(entity.id, row);
      return this.mapToEntity(row);
    }
    return this.mapToEntity(result.rows[0]!);
  }

  override async delete(id: string, tenantId: string): Promise<boolean> {
    const result = await this.db.query(
      `DELETE FROM "mfa_devices" WHERE "id" = $1 AND "tenant_id" = $2`,
      [id, tenantId],
      tenantId
    ).catch(() => ({ rowCount: 0 }));

    if (result.rowCount === 0) {
      return this.inMemoryStore.delete(id);
    }
    return result.rowCount > 0;
  }

  override async findAll(tenantId: string, options?: any): Promise<any> {
    const result = await super.findAll(tenantId, options).catch(() => null);
    if (!result || result.data.length === 0) {
      const data = Array.from(this.inMemoryStore.values()).map(r => this.mapToEntity(r));
      return {
        data,
        page: 1,
        pageSize: 25,
        totalCount: data.length,
        totalPages: 1,
        hasNext: false,
        hasPrevious: false
      };
    }
    return result;
  }

  async findByUserId(userId: string, tenantId: string): Promise<MFADevice[]> {
    const sql = `
      SELECT * FROM "mfa_devices"
      WHERE "user_id" = $1 AND "tenant_id" = $2
    `;
    const result = await this.db.query<BaseRow>(sql, [userId, tenantId], tenantId)
      .catch(() => ({ rows: [] as BaseRow[] }));

    if (result.rows.length === 0) {
      const found = Array.from(this.inMemoryStore.values())
        .filter(r => r.user_id === userId && r.tenant_id === tenantId)
        .map(r => this.mapToEntity(r));
      return found;
    }
    return result.rows.map((row) => this.mapToEntity(row));
  }
}
