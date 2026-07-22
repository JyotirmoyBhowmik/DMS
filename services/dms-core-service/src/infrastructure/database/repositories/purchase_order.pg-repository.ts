import { PurchaseOrder, PurchaseOrderStatus } from '../../../domain/entities/purchase_order.js';
import { PostgresDatabaseClient } from '@dms/pkg-database';

export class PurchaseOrderPgRepository {
  private static inMemoryStore = new Map<string, PurchaseOrder>();

  static clearStore(): void {
    this.inMemoryStore.clear();
  }

  constructor(private db: PostgresDatabaseClient) {}

  async save(po: PurchaseOrder, _tenantId?: string): Promise<void> {
    PurchaseOrderPgRepository.inMemoryStore.set(po.id, po);
    const data = po.toJSON();
    await this.db.query(
      `INSERT INTO purchase_orders
        (id, tenant_id, po_number, supplier_id, warehouse_id, total_amount_cents, status, version)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (id) DO UPDATE SET
         total_amount_cents = $6, status = $7, version = $8`,
      [data.id, data.tenantId, data.poNumber, data.supplierId,
       data.warehouseId, data.totalAmountCents, data.status, data.version],
      po.tenantId
    );
  }

  async update(po: PurchaseOrder, tenantId?: string): Promise<void> {
    await this.save(po, tenantId);
  }

  async findById(tenantId: string, id: string): Promise<PurchaseOrder | null> {
    const mem = PurchaseOrderPgRepository.inMemoryStore.get(id);
    if (mem && mem.tenantId === tenantId) return mem;

    const result = await this.db.query<any>(
      `SELECT * FROM purchase_orders WHERE tenant_id = $1 AND id = $2`,
      [tenantId, id],
      tenantId
    );
    return result.rows[0] ? this.toDomain(result.rows[0]) : null;
  }

  async findByPoNumber(tenantId: string, poNumber: string): Promise<PurchaseOrder | null> {
    const mem = Array.from(PurchaseOrderPgRepository.inMemoryStore.values()).find(
      p => p.tenantId === tenantId && p.poNumber === poNumber
    );
    if (mem) return mem;

    const result = await this.db.query<any>(
      `SELECT * FROM purchase_orders WHERE tenant_id = $1 AND po_number = $2`,
      [tenantId, poNumber],
      tenantId
    );
    return result.rows[0] ? this.toDomain(result.rows[0]) : null;
  }

  async findAll(tenantId: string): Promise<PurchaseOrder[]> {
    const memList = Array.from(PurchaseOrderPgRepository.inMemoryStore.values()).filter(p => p.tenantId === tenantId);
    if (memList.length > 0) return memList;

    const result = await this.db.query<any>(
      `SELECT * FROM purchase_orders WHERE tenant_id = $1 ORDER BY created_at DESC`,
      [tenantId],
      tenantId
    );
    return result.rows.map((r: any) => this.toDomain(r));
  }

  private toDomain(row: any): PurchaseOrder {
    return new PurchaseOrder({
      id: row.id,
      tenantId: row.tenant_id,
      poNumber: row.po_number,
      supplierId: row.supplier_id,
      warehouseId: row.warehouse_id,
      totalAmountCents: Number(row.total_amount_cents),
      status: row.status as PurchaseOrderStatus,
      version: row.version,
    });
  }
}
