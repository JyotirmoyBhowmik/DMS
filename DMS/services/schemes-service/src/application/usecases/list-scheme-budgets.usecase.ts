import { SchemeBudget, SchemeBudgetStatus } from '../../domain/entities/scheme_budget.js';
import { SchemeBudgetPgRepository } from '../../infrastructure/database/repositories/scheme_budget.pg-repository.js';
import { Principal, RbacGuard } from '@dms/pkg-rbac';

export interface ListSchemeBudgetsQuery {
  status?: SchemeBudgetStatus;
  schemeId?: string;
  budgetCode?: string;
  page?: number;
  pageSize?: number;
}

export interface PaginatedSchemeBudgets {
  data: SchemeBudget[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export class ListSchemeBudgetsUseCase {
  constructor(private budgetRepo: SchemeBudgetPgRepository) {}

  async execute(principal: Principal, query: ListSchemeBudgetsQuery): Promise<PaginatedSchemeBudgets> {
    // 1. Authorize permission
    if (!RbacGuard.can(principal, 'scheme_budget:read') && !RbacGuard.can(principal, 'scheme_budgets:read')) {
      throw new Error('Forbidden: Insufficient permissions to list scheme budgets');
    }

    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 20));

    // 2. Fetch records
    let items = await this.budgetRepo.findAll(principal.tenantId);

    if (query.status) {
      items = items.filter(b => b.status === query.status);
    }
    if (query.schemeId) {
      items = items.filter(b => b.schemeId === query.schemeId);
    }
    if (query.budgetCode) {
      items = items.filter(b => b.budgetCode === query.budgetCode);
    }

    const total = items.length;
    const totalPages = Math.ceil(total / pageSize) || 1;
    const offset = (page - 1) * pageSize;
    const paginatedData = items.slice(offset, offset + pageSize);

    return {
      data: paginatedData,
      total,
      page,
      pageSize,
      totalPages,
    };
  }
}
