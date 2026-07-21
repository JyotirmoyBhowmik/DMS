import { Outlet, OutletChannelType, OutletStatus } from '../../../domain/entities/outlet.js';
import { OutletPgRepository } from '../../../infrastructure/database/repositories/outlet.pg-repository.js';
import { Principal, RbacGuard } from '@dms/pkg-rbac';

export interface ListOutletsQuery {
  channelType?: OutletChannelType;
  status?: OutletStatus;
  distributorId?: string;
  page?: number;
  pageSize?: number;
}

export interface PaginatedOutlets {
  data: Outlet[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export class ListOutletsUseCase {
  constructor(private outletRepo: OutletPgRepository) {}

  async execute(principal: Principal, query: ListOutletsQuery): Promise<PaginatedOutlets> {
    // 1. Authorize permission
    if (!RbacGuard.can(principal, 'outlet:read') && !RbacGuard.can(principal, 'outlets:read')) {
      throw new Error('Forbidden: Insufficient permissions to list outlets');
    }

    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 20));

    // 2. Fetch records
    let items: Outlet[] = [];
    if (query.channelType) {
      items = await this.outletRepo.findByChannel(principal.tenantId, query.channelType);
    } else if (query.status) {
      items = await this.outletRepo.findByStatus(principal.tenantId, query.status);
    } else {
      items = await this.outletRepo.findAll(principal.tenantId);
    }

    if (query.distributorId) {
      items = items.filter(o => o.distributorId === query.distributorId);
    }
    if (query.status) {
      items = items.filter(o => o.status === query.status);
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
