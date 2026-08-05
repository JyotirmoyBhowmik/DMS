import { Distributor } from '../../../domain/entities/distributor.js';
import { DistributorRepository } from '../../../domain/repositories/distributor.repository.js';
import { BusinessRuleViolationError } from '../../../domain/errors/domain-error.js';
import { Principal, RbacGuard } from '@dms/pkg-rbac';
import { PaginatedResult } from '@dms/pkg-database';
import { ListDistributorsSchema } from '@dms/pkg-validation';

export interface ListDistributorsInput {
  tenantId: string;
  page?: string | number;
  pageSize?: string | number;
  region?: string;
}

export class ListDistributorsUseCase {
  constructor(private repo: DistributorRepository) {}

  async execute(principal: Principal, input: ListDistributorsInput): Promise<PaginatedResult<Distributor>> {
    // 1. Authorize: check tenant + RBAC permission
    if (principal.tenantId !== input.tenantId) {
      throw new BusinessRuleViolationError('Forbidden: Tenant boundary violation');
    }
    if (!RbacGuard.can(principal, 'distributors:read')) {
      throw new BusinessRuleViolationError('Forbidden: Insufficient permissions to list distributors');
    }

    // 2. Validate parameters
    const parsed = ListDistributorsSchema.parse(input);

    const options: any = {
      page: parsed.page,
      pageSize: parsed.pageSize,
      orderBy: 'created_at',
      orderDirection: 'DESC',
      where: {},
    };

    if (parsed.region) {
      options.where.region = parsed.region;
    }

    return await this.repo.findAll(input.tenantId, options);
  }
}
