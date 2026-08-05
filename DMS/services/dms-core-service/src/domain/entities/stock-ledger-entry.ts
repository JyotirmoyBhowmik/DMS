/**
 * StockLedgerEntry Domain Entity.
 * Append-only audit trail for stock movements. Entries are IMMUTABLE.
 */

export type TransactionType = 'INWARD' | 'OUTWARD' | 'ADJUSTMENT' | 'TRANSFER' | 'RETURN' | 'WRITE_OFF';
export type ReferenceType = 'ORDER' | 'TRANSFER' | 'RETURN' | 'MANUAL';

export interface StockLedgerEntryProps {
  id: string;
  tenantId: string;
  productId: string;
  warehouseId: string;
  batchNumber: string;
  transactionType: TransactionType;
  quantity: number;
  runningBalance: number;
  referenceId?: string;
  referenceType?: ReferenceType;
  createdBy: string;
  createdAt?: string;
}

export class StockLedgerEntry {
  public readonly id: string;
  public readonly tenantId: string;
  public readonly productId: string;
  public readonly warehouseId: string;
  public readonly batchNumber: string;
  public readonly transactionType: TransactionType;
  public readonly quantity: number;
  public readonly runningBalance: number;
  public readonly referenceId?: string;
  public readonly referenceType?: ReferenceType;
  public readonly createdBy: string;
  public readonly createdAt: string;

  // All fields are readonly — entry is immutable after creation
  private constructor(props: StockLedgerEntryProps) {
    this.id = props.id;
    this.tenantId = props.tenantId;
    this.productId = props.productId;
    this.warehouseId = props.warehouseId;
    this.batchNumber = props.batchNumber;
    this.transactionType = props.transactionType;
    this.quantity = props.quantity;
    this.runningBalance = props.runningBalance;
    this.referenceId = props.referenceId;
    this.referenceType = props.referenceType;
    this.createdBy = props.createdBy;
    this.createdAt = props.createdAt ?? new Date().toISOString();
  }

  /**
   * Creates a new immutable ledger entry.
   * Business rule: running balance must never go negative.
   */
  static create(props: StockLedgerEntryProps): StockLedgerEntry {
    if (props.runningBalance < 0) {
      throw new Error(
        `Running balance cannot be negative. Product: ${props.productId}, Batch: ${props.batchNumber}, ` +
        `Transaction: ${props.transactionType}, Qty: ${props.quantity}, Balance: ${props.runningBalance}`
      );
    }
    return new StockLedgerEntry(props);
  }

  /**
   * Utility: compute new running balance from previous balance and transaction.
   */
  static computeRunningBalance(previousBalance: number, transactionType: TransactionType, quantity: number): number {
    switch (transactionType) {
      case 'INWARD':
      case 'RETURN':
        return previousBalance + Math.abs(quantity);
      case 'OUTWARD':
      case 'WRITE_OFF':
        return previousBalance - Math.abs(quantity);
      case 'ADJUSTMENT':
      case 'TRANSFER':
        // quantity can be positive (in) or negative (out)
        return previousBalance + quantity;
      default:
        throw new Error(`Unknown transaction type: ${transactionType}`);
    }
  }

  toJSON() {
    return {
      id: this.id,
      tenantId: this.tenantId,
      productId: this.productId,
      warehouseId: this.warehouseId,
      batchNumber: this.batchNumber,
      transactionType: this.transactionType,
      quantity: this.quantity,
      runningBalance: this.runningBalance,
      referenceId: this.referenceId,
      referenceType: this.referenceType,
      createdBy: this.createdBy,
      createdAt: this.createdAt,
    };
  }
}
