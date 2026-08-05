/**
 * StockLedger Repository Interface (Port).
 * Append-only — no update or delete methods.
 */
import { StockLedgerEntry, TransactionType } from '../entities/stock-ledger-entry.js';

export abstract class StockLedgerRepository {
  abstract append(entry: StockLedgerEntry): Promise<void>;
  abstract findById(tenantId: string, id: string): Promise<StockLedgerEntry | null>;
  abstract findByProduct(tenantId: string, productId: string, warehouseId: string): Promise<StockLedgerEntry[]>;
  abstract findByBatch(tenantId: string, productId: string, batchNumber: string): Promise<StockLedgerEntry[]>;
  abstract findByReference(tenantId: string, referenceId: string): Promise<StockLedgerEntry[]>;
  abstract findByType(tenantId: string, transactionType: TransactionType): Promise<StockLedgerEntry[]>;
  abstract getLatestBalance(tenantId: string, productId: string, warehouseId: string, batchNumber: string): Promise<number>;
  abstract findByDateRange(tenantId: string, from: string, to: string): Promise<StockLedgerEntry[]>;
}
