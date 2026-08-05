import { Scheme, SchemeStatus, SchemeType } from '../../domain/entities/scheme.js';
import { SchemePgRepository } from '../../infrastructure/database/repositories/scheme.pg-repository.js';
import { Principal, RbacGuard } from '@dms/pkg-rbac';

export interface ListSchemesQuery {
  status?: SchemeStatus;
  schemeType?: SchemeType;
  code?: string;
  page?: number;
  pageSize?: number;
}

export interface PaginatedSchemes {
  data: Scheme[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export class ListSchemesUseCase {
  constructor(private schemeRepo: SchemePgRepository) {}

  async execute(principal: Principal, query: ListSchemesQuery): Promise<PaginatedSchemes> {
    // 1. Authorize permission
    if (!RbacGuard.can(principal, 'scheme:read') && !RbacGuard.can(principal, 'schemes:read')) {
      throw new Error('Forbidden: Insufficient permissions to list schemes');
    }

    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 20));

    // 2. Fetch records
    let items = await this.schemeRepo.findAll(principal.tenantId);

    if (query.status) {
      items = items.filter(s => s.status === query.status);
    }
    if (query.schemeType) {
      items = items.filter(s => s.schemeType === query.schemeType);
    }
    if (query.code) {
      items = items.filter(s => s.code === query.code);
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
