import { StockTransfer, StockTransferStatus } from '../../../domain/entities/stock_transfer.js';
import { PostgresDatabaseClient } from '@dms/pkg-database';

export class StockTransferPgRepository {
  private static inMemoryStore = new Map<string, StockTransfer>();

  static clearStore(): void {
    this.inMemoryStore.clear();
  }

  constructor(private db: PostgresDatabaseClient) {}

  async save(transfer: StockTransfer, _tenantId?: string): Promise<void> {
    StockTransferPgRepository.inMemoryStore.set(transfer.id, transfer);
    const data = transfer.toJSON();
    await this.db.query(
      `INSERT INTO stock_transfers
        (id, tenant_id, transfer_number, source_warehouse_id, target_warehouse_id, sku_id, quantity, status, version)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (id) DO UPDATE SET
         status = $8, version = $9`,
      [data.id, data.tenantId, data.transferNumber, data.sourceWarehouseId,
       data.targetWarehouseId, data.skuId, data.quantity, data.status, data.version],
      transfer.tenantId
    );
  }

  async update(transfer: StockTransfer, tenantId?: string): Promise<void> {
    await this.save(transfer, tenantId);
  }

  async findById(tenantId: string, id: string): Promise<StockTransfer | null> {
    const mem = StockTransferPgRepository.inMemoryStore.get(id);
    if (mem && mem.tenantId === tenantId) return mem;

    const result = await this.db.query<any>(
      `SELECT * FROM stock_transfers WHERE tenant_id = $1 AND id = $2`,
      [tenantId, id],
      tenantId
    );
    return result.rows[0] ? this.toDomain(result.rows[0]) : null;
  }

  async findByTransferNumber(tenantId: string, transferNumber: string): Promise<StockTransfer | null> {
    const mem = Array.from(StockTransferPgRepository.inMemoryStore.values()).find(
      t => t.tenantId === tenantId && t.transferNumber === transferNumber
    );
    if (mem) return mem;

    const result = await this.db.query<any>(
      `SELECT * FROM stock_transfers WHERE tenant_id = $1 AND transfer_number = $2`,
      [tenantId, transferNumber],
      tenantId
    );
    return result.rows[0] ? this.toDomain(result.rows[0]) : null;
  }

  async findAll(tenantId: string): Promise<StockTransfer[]> {
    const memList = Array.from(StockTransferPgRepository.inMemoryStore.values()).filter(t => t.tenantId === tenantId);
    if (memList.length > 0) return memList;

    const result = await this.db.query<any>(
      `SELECT * FROM stock_transfers WHERE tenant_id = $1 ORDER BY created_at DESC`,
      [tenantId],
      tenantId
    );
    return result.rows.map((r: any) => this.toDomain(r));
  }

  private toDomain(row: any): StockTransfer {
    return new StockTransfer({
      id: row.id,
      tenantId: row.tenant_id,
      transferNumber: row.transfer_number,
      sourceWarehouseId: row.source_warehouse_id,
      targetWarehouseId: row.target_warehouse_id,
      skuId: row.sku_id,
      quantity: Number(row.quantity),
      status: row.status as StockTransferStatus,
      version: row.version,
    });
  }
}
