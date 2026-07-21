import { DistributorHierarchy } from '../../../domain/entities/distributor-hierarchy.js';
import { DistributorHierarchyPgRepository } from '../../../infrastructure/database/repositories/distributor-hierarchy.pg-repository.js';
import { Principal, RbacGuard } from '@dms/pkg-rbac';
import { QueryDistributorHierarchyDTO } from '@dms/pkg-validation';

export interface PaginatedDistributorHierarchies {
  data: DistributorHierarchy[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export class ListDistributorHierarchiesUseCase {
  constructor(private hierarchyRepo: DistributorHierarchyPgRepository) {}

  async execute(principal: Principal, query: QueryDistributorHierarchyDTO): Promise<PaginatedDistributorHierarchies> {
    // 1. Authorize permission
    if (!RbacGuard.can(principal, 'distributor_hierarchy:read') && !RbacGuard.can(principal, 'distributor-hierarchies:read')) {
      throw new Error('Forbidden: Insufficient permissions to list distributor hierarchies');
    }

    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 20));

    // 2. Fetch list from repository
    let items: DistributorHierarchy[] = [];
    if (query.parentDistributorId) {
      items = await this.hierarchyRepo.findByParent(principal.tenantId, query.parentDistributorId);
    } else if (query.childDistributorId) {
      const childItem = await this.hierarchyRepo.findByChild(principal.tenantId, query.childDistributorId);
      items = childItem ? [childItem] : [];
    } else {
      items = await this.hierarchyRepo.findActive(principal.tenantId);
    }

    // Apply additional in-memory filter criteria if present
    if (query.hierarchyLevel) {
      items = items.filter(h => h.hierarchyLevel === query.hierarchyLevel);
    }
    if (query.territory) {
      items = items.filter(h => h.territory.toLowerCase().includes(query.territory!.toLowerCase()));
    }
    if (query.isActive !== undefined) {
      items = items.filter(h => h.isActive === query.isActive);
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
