import { BasePostgresRepository, BaseRow } from '@dms/pkg-database';
import { SchemeEntity } from '../../../domain/entities/scheme.entity.js';
import { ISchemeRepository } from '../../../domain/repositories/scheme.repository.js';

export class SchemePgRepository extends BasePostgresRepository<SchemeEntity> implements ISchemeRepository {
  protected tableName(): string {
    return 'schemes';
  }

  protected mapToEntity(row: BaseRow): SchemeEntity {
    let rules = row.rules;
    if (typeof rules === 'string') {
      try {
        rules = JSON.parse(rules);
      } catch {
        rules = {};
      }
    }

    let payouts = row.payouts;
    if (typeof payouts === 'string') {
      try {
        payouts = JSON.parse(payouts);
      } catch {
        payouts = {};
      }
    }

    return new SchemeEntity({
      id: row.id,
      tenantId: row.tenant_id,
      name: row.name as string,
      description: row.description as string | undefined,
      status: row.status as any,
      startDate: row.start_date as Date,
      endDate: row.end_date as Date | undefined,
      rules: rules as any,
      payouts: payouts as any,
      version: row.version,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }

  protected mapToRow(entity: SchemeEntity): BaseRow {
    return {
      id: entity.id,
      tenant_id: entity.tenantId,
      name: entity.name,
      description: entity.description || null,
      status: entity.status,
      start_date: entity.startDate,
      end_date: entity.endDate || null,
      rules: JSON.stringify(entity.rules) as any,
      payouts: JSON.stringify(entity.payouts) as any,
      version: entity.version || 0,
      created_at: entity.createdAt || new Date(),
      updated_at: entity.updatedAt || new Date(),
    };
  }
}
