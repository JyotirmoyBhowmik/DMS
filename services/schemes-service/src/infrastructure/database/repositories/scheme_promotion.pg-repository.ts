import { SchemePromotion, SchemePromotionStatus, PromotionType } from '../../../domain/entities/scheme_promotion.js';
import { PostgresDatabaseClient } from '@dms/pkg-database';

export class SchemePromotionPgRepository {
  private static inMemoryStore = new Map<string, SchemePromotion>();

  static clearStore(): void {
    this.inMemoryStore.clear();
  }

  constructor(private db: PostgresDatabaseClient) {}

  async save(promo: SchemePromotion, _tenantId?: string): Promise<void> {
    SchemePromotionPgRepository.inMemoryStore.set(promo.id, promo);
    const data = promo.toJSON();
    await this.db.query(
      `INSERT INTO scheme_promotions
        (id, tenant_id, scheme_id, name, promo_code, promotion_type, discount_percentage, max_discount_cents, status, version)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (id) DO UPDATE SET
         status = $9, name = $4, discount_percentage = $7, version = $10`,
      [data.id, data.tenantId, data.schemeId, data.name, data.promoCode,
       data.promotionType, data.discountPercentage, data.maxDiscountCents,
       data.status, data.version],
      promo.tenantId
    );
  }

  async update(promo: SchemePromotion, tenantId?: string): Promise<void> {
    await this.save(promo, tenantId);
  }

  async findById(tenantId: string, id: string): Promise<SchemePromotion | null> {
    const mem = SchemePromotionPgRepository.inMemoryStore.get(id);
    if (mem && mem.tenantId === tenantId) return mem;

    const result = await this.db.query<any>(
      `SELECT * FROM scheme_promotions WHERE tenant_id = $1 AND id = $2`,
      [tenantId, id],
      tenantId
    );
    return result.rows[0] ? this.toDomain(result.rows[0]) : null;
  }

  async findByCode(tenantId: string, promoCode: string): Promise<SchemePromotion | null> {
    const mem = Array.from(SchemePromotionPgRepository.inMemoryStore.values()).find(
      p => p.tenantId === tenantId && p.promoCode === promoCode
    );
    if (mem) return mem;

    const result = await this.db.query<any>(
      `SELECT * FROM scheme_promotions WHERE tenant_id = $1 AND promo_code = $2`,
      [tenantId, promoCode],
      tenantId
    );
    return result.rows[0] ? this.toDomain(result.rows[0]) : null;
  }

  async findAll(tenantId: string): Promise<SchemePromotion[]> {
    const memList = Array.from(SchemePromotionPgRepository.inMemoryStore.values()).filter(p => p.tenantId === tenantId);
    if (memList.length > 0) return memList;

    const result = await this.db.query<any>(
      `SELECT * FROM scheme_promotions WHERE tenant_id = $1 ORDER BY created_at DESC`,
      [tenantId],
      tenantId
    );
    return result.rows.map((r: any) => this.toDomain(r));
  }

  private toDomain(row: any): SchemePromotion {
    return new SchemePromotion({
      id: row.id,
      tenantId: row.tenant_id,
      schemeId: row.scheme_id,
      name: row.name,
      promoCode: row.promo_code,
      promotionType: row.promotion_type as PromotionType,
      discountPercentage: Number(row.discount_percentage),
      maxDiscountCents: Number(row.max_discount_cents),
      status: row.status as SchemePromotionStatus,
      version: row.version,
    });
  }
}
