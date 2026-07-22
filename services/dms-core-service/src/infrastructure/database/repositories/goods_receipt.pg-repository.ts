import { GoodsReceipt, GoodsReceiptStatus } from '../../../domain/entities/goods_receipt.js';
import { PostgresDatabaseClient } from '@dms/pkg-database';

export class GoodsReceiptPgRepository {
  private static inMemoryStore = new Map<string, GoodsReceipt>();

  static clearStore(): void {
    this.inMemoryStore.clear();
  }

  constructor(private db: PostgresDatabaseClient) {}

  async save(gr: GoodsReceipt, _tenantId?: string): Promise<void> {
    GoodsReceiptPgRepository.inMemoryStore.set(gr.id, gr);
    const data = gr.toJSON();
    await this.db.query(
      `INSERT INTO goods_receipts
        (id, tenant_id, receipt_number, purchase_order_id, warehouse_id, sku_id, received_quantity, status, version)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (id) DO UPDATE SET
         status = $8, version = $9`,
      [data.id, data.tenantId, data.receiptNumber, data.purchaseOrderId,
       data.warehouseId, data.skuId, data.receivedQuantity, data.status, data.version],
      gr.tenantId
    );
  }

  async update(gr: GoodsReceipt, tenantId?: string): Promise<void> {
    await this.save(gr, tenantId);
  }

  async findById(tenantId: string, id: string): Promise<GoodsReceipt | null> {
    const mem = GoodsReceiptPgRepository.inMemoryStore.get(id);
    if (mem && mem.tenantId === tenantId) return mem;

    const result = await this.db.query<any>(
      `SELECT * FROM goods_receipts WHERE tenant_id = $1 AND id = $2`,
      [tenantId, id],
      tenantId
    );
    return result.rows[0] ? this.toDomain(result.rows[0]) : null;
  }

  async findByReceiptNumber(tenantId: string, receiptNumber: string): Promise<GoodsReceipt | null> {
    const mem = Array.from(GoodsReceiptPgRepository.inMemoryStore.values()).find(
      g => g.tenantId === tenantId && g.receiptNumber === receiptNumber
    );
    if (mem) return mem;

    const result = await this.db.query<any>(
      `SELECT * FROM goods_receipts WHERE tenant_id = $1 AND receipt_number = $2`,
      [tenantId, receiptNumber],
      tenantId
    );
    return result.rows[0] ? this.toDomain(result.rows[0]) : null;
  }

  async findAll(tenantId: string): Promise<GoodsReceipt[]> {
    const memList = Array.from(GoodsReceiptPgRepository.inMemoryStore.values()).filter(g => g.tenantId === tenantId);
    if (memList.length > 0) return memList;

    const result = await this.db.query<any>(
      `SELECT * FROM goods_receipts WHERE tenant_id = $1 ORDER BY created_at DESC`,
      [tenantId],
      tenantId
    );
    return result.rows.map((r: any) => this.toDomain(r));
  }

  private toDomain(row: any): GoodsReceipt {
    return new GoodsReceipt({
      id: row.id,
      tenantId: row.tenant_id,
      receiptNumber: row.receipt_number,
      purchaseOrderId: row.purchase_order_id,
      warehouseId: row.warehouse_id,
      skuId: row.sku_id,
      receivedQuantity: Number(row.received_quantity),
      status: row.status as GoodsReceiptStatus,
      version: row.version,
    });
  }
}
