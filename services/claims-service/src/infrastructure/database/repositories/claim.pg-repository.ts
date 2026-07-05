import { BasePostgresRepository, BaseRow } from '@dms/pkg-database';
import { ClaimEntity } from '../../../domain/entities/claim.entity.js';
import { IClaimRepository } from '../../../domain/repositories/claim.repository.js';

export class ClaimPgRepository extends BasePostgresRepository<ClaimEntity> implements IClaimRepository {
  protected tableName(): string {
    return 'claims';
  }

  protected mapToEntity(row: BaseRow): ClaimEntity {
    return new ClaimEntity({
      id: row.id,
      tenantId: row.tenant_id,
      distributorId: row.distributor_id as string,
      schemeId: row.scheme_id as string,
      amount: Number(row.amount),
      settledAmount: Number(row.settled_amount),
      status: row.status as any,
      duplicateCheckKey: row.duplicate_check_key as string | undefined,
      version: row.version,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }

  protected mapToRow(entity: ClaimEntity): BaseRow {
    return {
      id: entity.id,
      tenant_id: entity.tenantId,
      distributor_id: entity.distributorId,
      scheme_id: entity.schemeId,
      amount: entity.amount,
      settled_amount: entity.settledAmount,
      status: entity.status === 'draft' ? 'raised' : entity.status,
      duplicate_check_key: entity.duplicateCheckKey || null,
      version: entity.version || 0,
      created_at: entity.createdAt || new Date(),
      updated_at: entity.updatedAt || new Date(),
    };
  }
}
