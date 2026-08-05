import { CompetitorCaptureRepository } from '../../../domain/repositories/competitor-capture.repository.js';
import { CompetitorCapture } from '../../../domain/entities/competitor-capture.js';
import { RbacGuard, Principal } from '@dms/pkg-rbac';
import { PostgresDatabaseClient } from '@dms/pkg-database';
import { CompetitorCapturePgRepository } from '../../../infrastructure/database/repositories/competitor-capture.pg-repository.js';

export interface ListCompetitorCapturesQuery {
  page?: number;
  pageSize?: number;
  agentId?: string;
  outletId?: string;
  status?: string;
  brand?: string;
}

export interface ListCompetitorCapturesResponse {
  data: CompetitorCapture[];
  page: number;
  pageSize: number;
  total: number;
}

export class ListCompetitorCapturesUseCase {
  constructor(
    private readonly db?: PostgresDatabaseClient,
    private readonly repo?: CompetitorCaptureRepository
  ) {}

  async execute(
    principal: Principal,
    tenantId: string,
    query: ListCompetitorCapturesQuery
  ): Promise<ListCompetitorCapturesResponse> {
    if (!principal) {
      throw new Error('Forbidden: Authentication required');
    }
    if (principal.tenantId !== tenantId) {
      throw new Error('Forbidden: Tenant context mismatch');
    }
    if (!RbacGuard.can(principal, 'competitor_capture:read')) {
      throw new Error('Forbidden: Insufficient permissions');
    }

    const activeRepo = this.repo || new CompetitorCapturePgRepository(this.db);
    let captures: CompetitorCapture[] = [];

    if (query.agentId) {
      captures = await activeRepo.findByAgent(query.agentId, tenantId);
    } else if (query.outletId) {
      captures = await activeRepo.findByOutlet(query.outletId, tenantId);
    } else {
      captures = await activeRepo.findAll(tenantId);
    }

    // Additional in-memory filtering (status, brand)
    if (query.status) {
      captures = captures.filter((c) => c.status === query.status);
    }
    if (query.brand) {
      const lowerBrand = query.brand.toLowerCase();
      captures = captures.filter((c) => c.brand.toLowerCase().includes(lowerBrand));
    }

    const page = query.page && query.page > 0 ? query.page : 1;
    const rawPageSize = query.pageSize && query.pageSize > 0 ? query.pageSize : 10;
    const pageSize = Math.min(rawPageSize, 100);

    const total = captures.length;
    const startIdx = (page - 1) * pageSize;
    const paginatedData = captures.slice(startIdx, startIdx + pageSize);

    return {
      data: paginatedData,
      page,
      pageSize,
      total,
    };
  }
}
