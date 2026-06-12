import { BasePostgresRepository, BaseRow } from '@dms/pkg-database';
import { MFADevice } from '../../../domain/entities/mfa_device.js';
import { MFADeviceRepository } from '../../../domain/repositories/mfa_device.repository.js';

export class MFADevicePgRepository extends BasePostgresRepository<MFADevice> implements MFADeviceRepository {
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

  async findByUserId(userId: string, tenantId: string): Promise<MFADevice[]> {
    const sql = `
      SELECT * FROM "mfa_devices"
      WHERE "user_id" = $1 AND "tenant_id" = $2
    `;
    const result = await this.db.query<BaseRow>(sql, [userId, tenantId], tenantId);
    return result.rows.map((row) => this.mapToEntity(row));
  }
}
