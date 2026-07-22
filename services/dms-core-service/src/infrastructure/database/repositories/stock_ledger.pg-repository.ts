import { StockLedgerEntry, TransactionType } from '../../../domain/entities/stock_ledger_entry.js';
import { PostgresDatabaseClient } from '@dms/pkg-database';

export class StockLedgerPgRepository {
  private static inMemoryStore = new Map<string, StockLedgerEntry>();

  static clearStore(): void {
    this.inMemoryStore.clear();
  }

  constructor(private db: PostgresDatabaseClient) {}

  async save(entry: StockLedgerEntry, _tenantId?: string): Promise<void> {
    StockLedgerPgRepository.inMemoryStore.set(entry.id, entry);
    const data = entry.toJSON();
    await this.db.query(
      `INSERT INTO stock_ledger
        (id, tenant_id, warehouse_id, sku_id, batch_number, transaction_type, quantity, running_balance, reference_id, version)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (id) DO UPDATE SET
         quantity = $7, running_balance = $8, reference_id = $9, version = $10`,
      [data.id, data.tenantId, data.warehouseId, data.skuId, data.batchNumber,
       data.transactionType, data.quantity, data.runningBalance, data.referenceId, data.version],
      entry.tenantId
    );
  }

  async update(entry: StockLedgerEntry, tenantId?: string): Promise<void> {
    await this.save(entry, tenantId);
  }

  async findById(tenantId: string, id: string): Promise<StockLedgerEntry | null> {
    const mem = StockLedgerPgRepository.inMemoryStore.get(id);
    if (mem && mem.tenantId === tenantId) return mem;

    const result = await this.db.query<any>(
      `SELECT * FROM stock_ledger WHERE tenant_id = $1 AND id = $2`,
      [tenantId, id],
      tenantId
    );
    return result.rows[0] ? this.toDomain(result.rows[0]) : null;
  }

  async getLatestBalance(tenantId: string, skuId: string, warehouseId: string, batchNumber?: string): Promise<number> {
    const memList = Array.from(StockLedgerPgRepository.inMemoryStore.values()).filter(
      e => e.tenantId === tenantId && e.skuId === skuId && e.warehouseId === warehouseId && (!batchNumber || e.batchNumber === batchNumber)
    );
    if (memList.length > 0) {
      return memList[memList.length - 1].runningBalance;
    }

    const result = await this.db.query<any>(
      `SELECT running_balance FROM stock_ledger
       WHERE tenant_id = $1 AND sku_id = $2 AND warehouse_id = $3
       ORDER BY created_at DESC LIMIT 1`,
      [tenantId, skuId, warehouseId],
      tenantId
    );
    return result.rows[0] ? Number(result.rows[0].running_balance) : 0;
  }

  async findAll(tenantId: string): Promise<StockLedgerEntry[]> {
    const memList = Array.from(StockLedgerPgRepository.inMemoryStore.values()).filter(e => e.tenantId === tenantId);
    if (memList.length > 0) return memList;

    const result = await this.db.query<any>(
      `SELECT * FROM stock_ledger WHERE tenant_id = $1 ORDER BY created_at DESC`,
      [tenantId],
      tenantId
    );
    return result.rows.map((r: any) => this.toDomain(r));
  }

  private toDomain(row: any): StockLedgerEntry {
    return new StockLedgerEntry({
      id: row.id,
      tenantId: row.tenant_id,
      warehouseId: row.warehouse_id,
      skuId: row.sku_id,
      batchNumber: row.batch_number,
      transactionType: row.transaction_type as TransactionType,
      quantity: Number(row.quantity),
      runningBalance: Number(row.running_balance),
      referenceId: row.reference_id,
      version: row.version,
    });
  }
}
