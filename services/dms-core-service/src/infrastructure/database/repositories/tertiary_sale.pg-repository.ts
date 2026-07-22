import { TertiarySale, TertiarySaleStatus } from '../../../domain/entities/tertiary_sale.js';
import { PostgresDatabaseClient } from '@dms/pkg-database';

export class TertiarySalePgRepository {
  private static inMemoryStore = new Map<string, TertiarySale>();

  static clearStore(): void {
    this.inMemoryStore.clear();
  }

  constructor(private db: PostgresDatabaseClient) {}

  async save(sale: TertiarySale, _tenantId?: string): Promise<void> {
    TertiarySalePgRepository.inMemoryStore.set(sale.id, sale);
    const data = sale.toJSON();
    await this.db.query(
      `INSERT INTO tertiary_sales
        (id, tenant_id, invoice_number, consumer_id, outlet_id, sku_id, quantity, unit_price_cents, total_amount_cents, status, version)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       ON CONFLICT (id) DO UPDATE SET
         status = $10, version = $11`,
      [data.id, data.tenantId, data.invoiceNumber, data.consumerId, data.outletId,
       data.skuId, data.quantity, data.unitPriceCents, data.totalAmountCents, data.status, data.version],
      sale.tenantId
    );
  }

  async update(sale: TertiarySale, tenantId?: string): Promise<void> {
    await this.save(sale, tenantId);
  }

  async findById(tenantId: string, id: string): Promise<TertiarySale | null> {
    const mem = TertiarySalePgRepository.inMemoryStore.get(id);
    if (mem && mem.tenantId === tenantId) return mem;

    const result = await this.db.query<any>(
      `SELECT * FROM tertiary_sales WHERE tenant_id = $1 AND id = $2`,
      [tenantId, id],
      tenantId
    );
    return result.rows[0] ? this.toDomain(result.rows[0]) : null;
  }

  async findByInvoiceNumber(tenantId: string, invoiceNumber: string): Promise<TertiarySale | null> {
    const mem = Array.from(TertiarySalePgRepository.inMemoryStore.values()).find(
      s => s.tenantId === tenantId && s.invoiceNumber === invoiceNumber
    );
    if (mem) return mem;

    const result = await this.db.query<any>(
      `SELECT * FROM tertiary_sales WHERE tenant_id = $1 AND invoice_number = $2`,
      [tenantId, invoiceNumber],
      tenantId
    );
    return result.rows[0] ? this.toDomain(result.rows[0]) : null;
  }

  async findAll(tenantId: string): Promise<TertiarySale[]> {
    const memList = Array.from(TertiarySalePgRepository.inMemoryStore.values()).filter(s => s.tenantId === tenantId);
    if (memList.length > 0) return memList;

    const result = await this.db.query<any>(
      `SELECT * FROM tertiary_sales WHERE tenant_id = $1 ORDER BY created_at DESC`,
      [tenantId],
      tenantId
    );
    return result.rows.map((r: any) => this.toDomain(r));
  }

  private toDomain(row: any): TertiarySale {
    return new TertiarySale({
      id: row.id,
      tenantId: row.tenant_id,
      invoiceNumber: row.invoice_number,
      consumerId: row.consumer_id,
      outletId: row.outlet_id,
      skuId: row.sku_id,
      quantity: Number(row.quantity),
      unitPriceCents: Number(row.unit_price_cents),
      totalAmountCents: Number(row.total_amount_cents),
      status: row.status as TertiarySaleStatus,
      version: row.version,
    });
  }
}
