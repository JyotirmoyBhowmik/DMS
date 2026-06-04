import { PostgresDatabaseClient, BasePostgresRepository, BaseRow } from '@dms/pkg-database';
import { Survey, Question, ResponseItem } from '../../../domain/entities/survey.js';
import { SurveyRepository } from '../../../domain/repositories/survey.repository.js';

export class SurveyPgRepository
  extends BasePostgresRepository<Survey>
  implements SurveyRepository
{
  constructor(db: PostgresDatabaseClient) {
    super(db);
  }

  protected tableName(): string {
    return 'surveys';
  }

  protected mapToEntity(row: BaseRow): Survey {
    return Survey.fromPersistence({
      id: row.id as string,
      tenantId: row.tenant_id as string,
      outletId: row.outlet_id as string,
      agentId: row.agent_id as string,
      questions: row.questions as Question[],
      responses: row.responses as ResponseItem[],
      completedAt: row.completed_at ? new Date(row.completed_at as string | Date) : undefined,
      version: row.version as number,
      createdAt: row.created_at as Date,
      updatedAt: row.updated_at as Date,
    });
  }

  protected mapToRow(entity: Survey): BaseRow {
    return {
      id: entity.id,
      tenant_id: entity.tenantId,
      outlet_id: entity.outletId,
      agent_id: entity.agentId,
      questions: JSON.stringify(entity.questions),
      responses: JSON.stringify(entity.responses),
      completed_at: entity.completedAt ?? null,
      version: entity.version,
      created_at: entity.createdAt,
      updated_at: entity.updatedAt,
    };
  }

  async findByOutlet(outletId: string, tenantId: string): Promise<Survey[]> {
    const result = await this.findAll(tenantId, {
      where: { outlet_id: outletId },
      pageSize: 100,
      orderBy: 'created_at',
      orderDirection: 'DESC',
    });
    return result.data;
  }

  async findByAgent(agentId: string, tenantId: string): Promise<Survey[]> {
    const result = await this.findAll(tenantId, {
      where: { agent_id: agentId },
      pageSize: 100,
      orderBy: 'created_at',
      orderDirection: 'DESC',
    });
    return result.data;
  }
}
