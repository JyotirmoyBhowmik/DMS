import { PostgresDatabaseClient, BasePostgresRepository, BaseRow } from '@dms/pkg-database';
import { SalesTarget } from '../../../domain/entities/sales-target.js';
import { SalesTargetRepository } from '../../../domain/repositories/sales-target.repository.js';
import { Money } from '../../../domain/value-objects/money.js';

export class SalesTargetPgRepository
  extends BasePostgresRepository<SalesTarget>
  implements SalesTargetRepository
{
  constructor(db: PostgresDatabaseClient) {
    super(db);
  }

  protected tableName(): string {
    return 'sales_targets';
  }

  protected mapToEntity(row: BaseRow): SalesTarget {
    return SalesTarget.fromPersistence({
      id: row.id as string,
      tenantId: row.tenant_id as string,
      agentId: row.agent_id as string,
      periodMonth: row.period_month as number,
      periodYear: row.period_year as number,
      targetAmount: Money.of(parseFloat(row.target_amount as string)),
      achievedAmount: Money.of(parseFloat(row.achieved_amount as string)),
      targetType: row.target_type as string,
      version: row.version as number,
      createdAt: row.created_at as Date,
      updatedAt: row.updated_at as Date,
    });
  }

  protected mapToRow(entity: SalesTarget): BaseRow {
    return {
      id: entity.id,
      tenant_id: entity.tenantId,
      agent_id: entity.agentId,
      period_month: entity.periodMonth,
      period_year: entity.periodYear,
      target_amount: entity.targetAmount.amount,
      achieved_amount: entity.achievedAmount.amount,
      target_type: entity.targetType,
      version: entity.version,
      created_at: entity.createdAt,
      updated_at: entity.updatedAt,
    };
  }

  async findByAgentAndPeriod(
    agentId: string,
    periodMonth: number,
    periodYear: number,
    tenantId: string,
  ): Promise<SalesTarget[]> {
    const result = await this.findAll(tenantId, {
      where: {
        agent_id: agentId,
        period_month: periodMonth,
        period_year: periodYear,
      },
      pageSize: 100,
    });
    return result.data;
  }
}
