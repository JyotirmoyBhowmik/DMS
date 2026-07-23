import { SchemePromotion, SchemePromotionStatus, PromotionType } from '../../domain/entities/scheme_promotion.js';
import { SchemePromotionPgRepository } from '../../infrastructure/database/repositories/scheme_promotion.pg-repository.js';
import { Principal, RbacGuard } from '@dms/pkg-rbac';

export interface ListSchemePromotionsQuery {
  status?: SchemePromotionStatus;
  schemeId?: string;
  promoCode?: string;
  page?: number;
  pageSize?: number;
}

export interface PaginatedSchemePromotions {
  data: SchemePromotion[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export class ListSchemePromotionsUseCase {
  constructor(private promoRepo: SchemePromotionPgRepository) {}

  async execute(principal: Principal, query: ListSchemePromotionsQuery): Promise<PaginatedSchemePromotions> {
    // 1. Authorize permission
    if (!RbacGuard.can(principal, 'scheme_promotion:read') && !RbacGuard.can(principal, 'scheme_promotions:read')) {
      throw new Error('Forbidden: Insufficient permissions to list scheme promotions');
    }

    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 20));

    // 2. Fetch records
    let items = await this.promoRepo.findAll(principal.tenantId);

    if (query.status) {
      items = items.filter(p => p.status === query.status);
    }
    if (query.schemeId) {
      items = items.filter(p => p.schemeId === query.schemeId);
    }
    if (query.promoCode) {
      items = items.filter(p => p.promoCode === query.promoCode);
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
