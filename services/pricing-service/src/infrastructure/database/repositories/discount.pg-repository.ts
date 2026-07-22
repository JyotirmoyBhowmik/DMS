import { Discount, DiscountStatus, DiscountType } from '../../../domain/entities/discount.js';
import { PostgresDatabaseClient } from '@dms/pkg-database';

export class DiscountPgRepository {
  private static inMemoryStore = new Map<string, Discount>();

  static clearStore(): void {
    this.inMemoryStore.clear();
  }

  constructor(private db: PostgresDatabaseClient) {}

  async save(discount: Discount, _tenantId?: string): Promise<void> {
    DiscountPgRepository.inMemoryStore.set(discount.id, discount);
    const data = discount.toJSON();
    await this.db.query(
      `INSERT INTO discounts
        (id, tenant_id, name, code, discount_type, value, min_order_amount_cents, status, version)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (id) DO UPDATE SET
         status = $8, name = $3, value = $6, version = $9`,
      [data.id, data.tenantId, data.name, data.code, data.discountType,
       data.value, data.minOrderAmountCents, data.status, data.version],
      discount.tenantId
    );
  }

  async update(discount: Discount, tenantId?: string): Promise<void> {
    await this.save(discount, tenantId);
  }

  async findById(tenantId: string, id: string): Promise<Discount | null> {
    const mem = DiscountPgRepository.inMemoryStore.get(id);
    if (mem && mem.tenantId === tenantId) return mem;

    const result = await this.db.query<any>(
      `SELECT * FROM discounts WHERE tenant_id = $1 AND id = $2`,
      [tenantId, id],
      tenantId
    );
    return result.rows[0] ? this.toDomain(result.rows[0]) : null;
  }

  async findByCode(tenantId: string, code: string): Promise<Discount | null> {
    const mem = Array.from(DiscountPgRepository.inMemoryStore.values()).find(
      d => d.tenantId === tenantId && d.code === code
    );
    if (mem) return mem;

    const result = await this.db.query<any>(
      `SELECT * FROM discounts WHERE tenant_id = $1 AND code = $2`,
      [tenantId, code],
      tenantId
    );
    return result.rows[0] ? this.toDomain(result.rows[0]) : null;
  }

  async findAll(tenantId: string): Promise<Discount[]> {
    const memList = Array.from(DiscountPgRepository.inMemoryStore.values()).filter(d => d.tenantId === tenantId);
    if (memList.length > 0) return memList;

    const result = await this.db.query<any>(
      `SELECT * FROM discounts WHERE tenant_id = $1 ORDER BY created_at DESC`,
      [tenantId],
      tenantId
    );
    return result.rows.map((r: any) => this.toDomain(r));
  }

  private toDomain(row: any): Discount {
    return new Discount({
      id: row.id,
      tenantId: row.tenant_id,
      name: row.name,
      code: row.code,
      discountType: row.discount_type as DiscountType,
      value: Number(row.value),
      minOrderAmountCents: Number(row.min_order_amount_cents),
      status: row.status as DiscountStatus,
      version: row.version,
    });
  }
}
