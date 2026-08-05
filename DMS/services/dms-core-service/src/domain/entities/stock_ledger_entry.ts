/**
 * StockLedgerEntry Domain Entity.
 * Represents an immutable audit record for stock transactions (RECEIPT, ISSUE, ADJUSTMENT, TRANSFER)
 * and maintains continuous running balances per warehouse and SKU.
 */

export type TransactionType = 'RECEIPT' | 'ISSUE' | 'ADJUSTMENT' | 'TRANSFER';

export interface StockLedgerEntryProps {
  id: string;
  tenantId: string;
  warehouseId: string;
  skuId: string;
  batchNumber: string;
  transactionType: TransactionType;
  quantity: number;
  runningBalance: number;
  referenceId?: string;
  version?: number;
}

export class StockLedgerEntry {
  public readonly id: string;
  public readonly tenantId: string;
  public readonly warehouseId: string;
  public readonly skuId: string;
  public readonly batchNumber: string;
  public readonly transactionType: TransactionType;
  private _quantity: number;
  private _runningBalance: number;
  private _referenceId?: string;
  private _version: number;

  public readonly domainEvents: Array<{ type: string; payload: any }> = [];

  constructor(props: StockLedgerEntryProps) {
    if (!props.id || !props.tenantId || !props.warehouseId || !props.skuId || !props.batchNumber) {
      throw new Error('StockLedgerEntry must have id, tenantId, warehouseId, skuId, and batchNumber');
    }

    this.id = props.id;
    this.tenantId = props.tenantId;
    this.warehouseId = props.warehouseId;
    this.skuId = props.skuId;
    this.batchNumber = props.batchNumber;
    this.transactionType = props.transactionType;
    this._quantity = props.quantity;
    this._runningBalance = props.runningBalance;
    this._referenceId = props.referenceId;
    this._version = props.version ?? 1;
  }

  get quantity(): number { return this._quantity; }
  get runningBalance(): number { return this._runningBalance; }
  get referenceId(): string | undefined { return this._referenceId; }
  get version(): number { return this._version; }

  static computeRunningBalance(previousBalance: number, type: TransactionType, qty: number): number {
    if (type === 'RECEIPT') return previousBalance + qty;
    if (type === 'ISSUE') return previousBalance - qty;
    if (type === 'ADJUSTMENT') return previousBalance + qty;
    if (type === 'TRANSFER') return previousBalance + qty;
    return previousBalance + qty;
  }

  static create(props: StockLedgerEntryProps): StockLedgerEntry {
    const entry = new StockLedgerEntry(props);
    entry.domainEvents.push({
      type: 'distributor.stock_ledger.recorded',
      payload: {
        id: entry.id,
        warehouseId: entry.warehouseId,
        skuId: entry.skuId,
        transactionType: entry.transactionType,
        quantity: entry.quantity,
        runningBalance: entry.runningBalance,
      },
    });
    return entry;
  }

  updateDetails(qty?: number, referenceId?: string): void {
    if (qty !== undefined) this._quantity = qty;
    if (referenceId !== undefined) this._referenceId = referenceId;
    this._version++;

    this.domainEvents.push({
      type: 'distributor.stock_ledger.updated',
      payload: { id: this.id, quantity: this._quantity, referenceId: this._referenceId, version: this._version },
    });
  }

  toJSON() {
    return {
      id: this.id,
      tenantId: this.tenantId,
      warehouseId: this.warehouseId,
      skuId: this.skuId,
      batchNumber: this.batchNumber,
      transactionType: this.transactionType,
      quantity: this._quantity,
      runningBalance: this._runningBalance,
      referenceId: this._referenceId,
      version: this._version,
    };
  }
}
