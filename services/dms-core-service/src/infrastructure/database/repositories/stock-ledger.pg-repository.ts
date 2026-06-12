/**
 * Postgres Repository for StockLedger.
 * Append-only — no update or delete operations.
 */
import { StockLedgerEntry, TransactionType } from '../../../domain/entities/stock-ledger-entry.js';
import { StockLedgerRepository } from '../../../domain/repositories/stock-ledger.repository.js';
import { PostgresDatabaseClient } from '@dms/pkg-database';
import { createHash } from 'node:crypto';

function toUuid(val: string | undefined | null): string {
  if (!val) return '00000000-0000-0000-0000-000000000000';
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (uuidRegex.test(val)) return val;
  
  const hash = createHash('md5').update(val).digest('hex');
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-${hash.slice(12, 16)}-${hash.slice(16, 20)}-${hash.slice(20, 32)}`;
}

export class StockLedgerPgRepository extends StockLedgerRepository {
  constructor(private db: PostgresDatabaseClient) {
    super();
  }

  async append(entry: StockLedgerEntry): Promise<void> {
    const data = entry.toJSON();
    await this.db.query(
      `INSERT INTO stock_ledger
        (id, tenant_id, product_id, warehouse_id, batch_number, transaction_type,
         quantity, running_balance, reference_id, reference_type, created_by, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [
        toUuid(data.id),
        toUuid(data.tenantId),
        toUuid(data.productId),
        data.warehouseId,
        data.batchNumber,
        data.transactionType,
        data.quantity,
        data.runningBalance,
        data.referenceId ? toUuid(data.referenceId) : null,
        data.referenceType ?? null,
        toUuid(data.createdBy),
        data.createdAt
      ],
      data.tenantId
    );
  }

  async findById(tenantId: string, id: string): Promise<StockLedgerEntry | null> {
    const result = await this.db.query<any>(
      `SELECT * FROM stock_ledger WHERE tenant_id = $1 AND id = $2`,
      [toUuid(tenantId), toUuid(id)],
      tenantId
    );
    return result.rows[0] ? this.toDomain(result.rows[0]) : null;
  }

  async findByProduct(tenantId: string, productId: string, warehouseId: string): Promise<StockLedgerEntry[]> {
    const result = await this.db.query<any>(
      `SELECT * FROM stock_ledger WHERE tenant_id = $1 AND product_id = $2 AND warehouse_id = $3 ORDER BY created_at ASC`,
      [toUuid(tenantId), toUuid(productId), warehouseId],
      tenantId
    );
    return result.rows.map((r: any) => this.toDomain(r));
  }

  async findByBatch(tenantId: string, productId: string, batchNumber: string): Promise<StockLedgerEntry[]> {
    const result = await this.db.query<any>(
      `SELECT * FROM stock_ledger WHERE tenant_id = $1 AND product_id = $2 AND batch_number = $3 ORDER BY created_at ASC`,
      [toUuid(tenantId), toUuid(productId), batchNumber],
      tenantId
    );
    return result.rows.map((r: any) => this.toDomain(r));
  }

  async findByReference(tenantId: string, referenceId: string): Promise<StockLedgerEntry[]> {
    const result = await this.db.query<any>(
      `SELECT * FROM stock_ledger WHERE tenant_id = $1 AND reference_id = $2 ORDER BY created_at ASC`,
      [toUuid(tenantId), toUuid(referenceId)],
      tenantId
    );
    return result.rows.map((r: any) => this.toDomain(r));
  }

  async findByType(tenantId: string, transactionType: TransactionType): Promise<StockLedgerEntry[]> {
    const result = await this.db.query<any>(
      `SELECT * FROM stock_ledger WHERE tenant_id = $1 AND transaction_type = $2 ORDER BY created_at DESC`,
      [toUuid(tenantId), transactionType],
      tenantId
    );
    return result.rows.map((r: any) => this.toDomain(r));
  }

  async getLatestBalance(tenantId: string, productId: string, warehouseId: string, batchNumber: string): Promise<number> {
    const result = await this.db.query<any>(
      `SELECT running_balance FROM stock_ledger
       WHERE tenant_id = $1 AND product_id = $2 AND warehouse_id = $3 AND batch_number = $4
       ORDER BY created_at DESC LIMIT 1`,
      [toUuid(tenantId), toUuid(productId), warehouseId, batchNumber],
      tenantId
    );
    return result.rows[0] ? Number(result.rows[0].running_balance) : 0;
  }

  async findByDateRange(tenantId: string, from: string, to: string): Promise<StockLedgerEntry[]> {
    const result = await this.db.query<any>(
      `SELECT * FROM stock_ledger WHERE tenant_id = $1 AND created_at >= $2 AND created_at <= $3 ORDER BY created_at ASC`,
      [toUuid(tenantId), from, to],
      tenantId
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
      runningBalance: Number(row.running_balance),
      referenceId: row.reference_id,
      referenceType: row.reference_type,
      createdBy: row.created_by,
      createdAt: row.created_at?.toISOString?.() ?? row.created_at,
    });
  }
}
