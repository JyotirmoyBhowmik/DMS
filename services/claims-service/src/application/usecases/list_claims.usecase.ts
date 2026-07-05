import { StructuredLogger } from '@dms/pkg-logger';
import { ClaimEntity, ClaimStatus } from '../../domain/entities/claim.entity.js';
import { IClaimRepository } from '../../domain/repositories/claim.repository.js';
import { ClaimPgRepository } from '../../infrastructure/database/repositories/claim.pg-repository.js';
import { PostgresDatabaseClient, PaginatedResult } from '@dms/pkg-database';

export interface ListClaimsQuery {
  page?: number;
  pageSize?: number;
  status?: ClaimStatus;
  distributorId?: string;
  schemeId?: string;
  orderBy?: string;
  orderDirection?: 'ASC' | 'DESC';
}

export class ListClaimsUseCase {
  private logger = new StructuredLogger('ListClaimsUseCase');

  constructor(
    private readonly db?: PostgresDatabaseClient,
    private readonly claimRepo?: IClaimRepository
  ) {}

  async execute(tenantId: string, query: ListClaimsQuery): Promise<PaginatedResult<ClaimEntity>> {
    this.logger.info('Querying claims list', { status: query.status, distributorId: query.distributorId });

    if (this.db) {
      const repo = this.claimRepo || new ClaimPgRepository(this.db);
      const where: Record<string, unknown> = {};
      if (query.status) {
        where.status = query.status;
      }
      if (query.distributorId) {
        where.distributor_id = query.distributorId;
      }
      if (query.schemeId) {
        where.scheme_id = query.schemeId;
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
