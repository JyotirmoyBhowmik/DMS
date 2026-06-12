import { StructuredLogger } from '@dms/pkg-logger';
import { SchemeEntity, SchemeStatus } from '../../domain/entities/scheme.entity.js';
import { ISchemeRepository } from '../../domain/repositories/scheme.repository.js';
import { SchemePgRepository } from '../../infrastructure/database/repositories/scheme.pg-repository.js';
import { PostgresDatabaseClient, PaginatedResult } from '@dms/pkg-database';

export interface ListSchemesQuery {
  page?: number;
  pageSize?: number;
  status?: SchemeStatus;
  orderBy?: string;
  orderDirection?: 'ASC' | 'DESC';
}

export class ListSchemesUseCase {
  private logger = new StructuredLogger('ListSchemesUseCase');

  constructor(
    private readonly db?: PostgresDatabaseClient,
    private readonly schemeRepo?: ISchemeRepository
  ) {}

  async execute(tenantId: string, query: ListSchemesQuery): Promise<PaginatedResult<SchemeEntity>> {
    this.logger.info('Querying schemes list', { status: query.status });

    if (this.db) {
      const repo = this.schemeRepo || new SchemePgRepository(this.db);
      const where: Record<string, unknown> = {};
      if (query.status) {
        where.status = query.status;
      }
      return await repo.findAll(tenantId, {
        page: query.page,
        pageSize: query.pageSize,
        orderBy: query.orderBy || 'created_at',
        orderDirection: query.orderDirection || 'DESC',
        where
      });
    }

    throw new Error('Database client not configured');
  }
}
