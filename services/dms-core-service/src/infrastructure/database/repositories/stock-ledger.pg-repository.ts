/**
 * Postgres Repository for StockLedger.
 * Append-only — no update or delete operations.
 */
import { StockLedgerEntry, TransactionType } from '../../../domain/entities/stock-ledger-entry.js';
import { StockLedgerRepository } from '../../../domain/repositories/stock-ledger.repository.js';

export class StockLedgerPgRepository extends StockLedgerRepository {
  constructor(private pool: any) {
    super();
  }

  async append(entry: StockLedgerEntry): Promise<void> {
    const data = entry.toJSON();
    await this.pool.query(
      `INSERT INTO stock_ledger
        (id, tenant_id, product_id, warehouse_id, batch_number, transaction_type,
         quantity, running_balance, reference_id, reference_type, created_by, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [data.id, data.tenantId, data.productId, data.warehouseId, data.batchNumber,
       data.transactionType, data.quantity, data.runningBalance,
       data.referenceId ?? null, data.referenceType ?? null,
       data.createdBy, data.createdAt]
    );
  }

  async findById(tenantId: string, id: string): Promise<StockLedgerEntry | null> {
    const result = await this.pool.query(
      `SELECT * FROM stock_ledger WHERE tenant_id = $1 AND id = $2`,
      [tenantId, id]
    );
    return result.rows[0] ? this.toDomain(result.rows[0]) : null;
  }

  async findByProduct(tenantId: string, productId: string, warehouseId: string): Promise<StockLedgerEntry[]> {
    const result = await this.pool.query(
      `SELECT * FROM stock_ledger WHERE tenant_id = $1 AND product_id = $2 AND warehouse_id = $3 ORDER BY created_at ASC`,
      [tenantId, productId, warehouseId]
    );
    return result.rows.map((r: any) => this.toDomain(r));
  }

  async findByBatch(tenantId: string, productId: string, batchNumber: string): Promise<StockLedgerEntry[]> {
    const result = await this.pool.query(
      `SELECT * FROM stock_ledger WHERE tenant_id = $1 AND product_id = $2 AND batch_number = $3 ORDER BY created_at ASC`,
      [tenantId, productId, batchNumber]
    );
    return result.rows.map((r: any) => this.toDomain(r));
  }

  async findByReference(tenantId: string, referenceId: string): Promise<StockLedgerEntry[]> {
    const result = await this.pool.query(
      `SELECT * FROM stock_ledger WHERE tenant_id = $1 AND reference_id = $2 ORDER BY created_at ASC`,
      [tenantId, referenceId]
    );
    return result.rows.map((r: any) => this.toDomain(r));
  }

  async findByType(tenantId: string, transactionType: TransactionType): Promise<StockLedgerEntry[]> {
    const result = await this.pool.query(
      `SELECT * FROM stock_ledger WHERE tenant_id = $1 AND transaction_type = $2 ORDER BY created_at DESC`,
      [tenantId, transactionType]
    );
    return result.rows.map((r: any) => this.toDomain(r));
  }

  async getLatestBalance(tenantId: string, productId: string, warehouseId: string, batchNumber: string): Promise<number> {
    const result = await this.pool.query(
      `SELECT running_balance FROM stock_ledger
       WHERE tenant_id = $1 AND product_id = $2 AND warehouse_id = $3 AND batch_number = $4
       ORDER BY created_at DESC LIMIT 1`,
      [tenantId, productId, warehouseId, batchNumber]
    );
    return result.rows[0] ? Number(result.rows[0].running_balance) : 0;
  }

  async findByDateRange(tenantId: string, from: string, to: string): Promise<StockLedgerEntry[]> {
    const result = await this.pool.query(
      `SELECT * FROM stock_ledger WHERE tenant_id = $1 AND created_at >= $2 AND created_at <= $3 ORDER BY created_at ASC`,
      [tenantId, from, to]
    );
    return result.rows.map((r: any) => this.toDomain(r));
  }

  private toDomain(row: any): StockLedgerEntry {
    return StockLedgerEntry.create({
      id: row.id,
      tenantId: row.tenant_id,
      productId: row.product_id,
      warehouseId: row.warehouse_id,
      batchNumber: row.batch_number,
      transactionType: row.transaction_type,
      quantity: row.quantity,
      runningBalance: row.running_balance,
      referenceId: row.reference_id,
      referenceType: row.reference_type,
      createdBy: row.created_by,
      createdAt: row.created_at?.toISOString?.() ?? row.created_at,
    });
  }
}
