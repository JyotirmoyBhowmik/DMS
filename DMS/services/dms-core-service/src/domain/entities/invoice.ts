/**
 * Invoice Domain Entity.
 * GST-compliant invoicing with CGST/SGST/IGST breakdowns.
 * All monetary values in BIGINT (paise/cents).
 */

export type InvoiceStatus = 'DRAFT' | 'ISSUED' | 'PAID' | 'CANCELLED' | 'CREDIT_NOTE';

export interface InvoiceItem {
  id?: string;
  productId: string;
  description?: string;
  hsnCode?: string;
  quantity: number;
  unitPrice: number;
  discountAmount: number;
  taxableAmount: number;
  taxRatePct: number;
  taxAmount: number;
  totalAmount: number;
}

export interface InvoiceProps {
  id: string;
  tenantId: string;
  distributorId: string;
  orderId?: string;
  invoiceNumber: string;
  items: InvoiceItem[];
  grossAmount: number;
  discountAmount: number;
  taxableAmount: number;
  cgst: number;
  sgst: number;
  igst: number;
  totalTax: number;
  netAmount: number;
  currency?: string;
  status?: InvoiceStatus;
  dueDate: string;
  paidAt?: string;
  eInvoiceIrn?: string;
  eWayBillNumber?: string;
  version?: number;
}

export class Invoice {
  public readonly id: string;
  public readonly tenantId: string;
  public readonly distributorId: string;
  public readonly orderId?: string;
  public readonly invoiceNumber: string;
  private _items: InvoiceItem[];
  private _grossAmount: number;
  private _discountAmount: number;
  private _taxableAmount: number;
  private _cgst: number;
  private _sgst: number;
  private _igst: number;
  private _totalTax: number;
  private _netAmount: number;
  private _currency: string;
  private _status: InvoiceStatus;
  private _dueDate: string;
  private _paidAt?: string;
  private _eInvoiceIrn?: string;
  private _eWayBillNumber?: string;
  private _version: number;

  constructor(props: InvoiceProps) {
    this.id = props.id;
    this.tenantId = props.tenantId;
    this.distributorId = props.distributorId;
    this.orderId = props.orderId;
    this.invoiceNumber = props.invoiceNumber;
    this._items = [...props.items];
    this._grossAmount = props.grossAmount;
    this._discountAmount = props.discountAmount;
    this._taxableAmount = props.taxableAmount;
    this._cgst = props.cgst;
    this._sgst = props.sgst;
    this._igst = props.igst;
    this._totalTax = props.totalTax;
    this._netAmount = props.netAmount;
    this._currency = props.currency ?? 'INR';
    this._status = props.status ?? 'DRAFT';
    this._dueDate = props.dueDate;
    this._paidAt = props.paidAt;
    this._eInvoiceIrn = props.eInvoiceIrn;
    this._eWayBillNumber = props.eWayBillNumber;
    this._version = props.version ?? 1;
  }

  get items(): InvoiceItem[] { return [...this._items]; }
  get grossAmount(): number { return this._grossAmount; }
  get discountAmount(): number { return this._discountAmount; }
  get taxableAmount(): number { return this._taxableAmount; }
  get cgst(): number { return this._cgst; }
  get sgst(): number { return this._sgst; }
  get igst(): number { return this._igst; }
  get totalTax(): number { return this._totalTax; }
  get netAmount(): number { return this._netAmount; }
  get currency(): string { return this._currency; }
  get status(): InvoiceStatus { return this._status; }
  get dueDate(): string { return this._dueDate; }
  get paidAt(): string | undefined { return this._paidAt; }
  get eInvoiceIrn(): string | undefined { return this._eInvoiceIrn; }
  get eWayBillNumber(): string | undefined { return this._eWayBillNumber; }
  get version(): number { return this._version; }

  static create(props: InvoiceProps): Invoice {
    if (!props.items || props.items.length === 0) {
      throw new Error('Invoice must have at least one item');
    }
    if (props.netAmount < 0) {
      throw new Error('Net amount cannot be negative');
    }
    return new Invoice(props);
  }

  /**
   * Generate sequential invoice number.
   */
  static generateInvoiceNumber(tenantPrefix: string, sequence: number): string {
    const year = new Date().getFullYear();
    const month = String(new Date().getMonth() + 1).padStart(2, '0');
    return `${tenantPrefix}-INV-${year}${month}-${String(sequence).padStart(6, '0')}`;
  }

  issue(): void {
    if (this._status !== 'DRAFT') {
      throw new Error(`Cannot issue invoice in ${this._status} status`);
    }
    this._status = 'ISSUED';
    this._version++;
  }

  markPaid(paidAt?: string): void {
    if (this._status !== 'ISSUED') {
      throw new Error(`Cannot mark as paid from ${this._status} status`);
    }
    this._paidAt = paidAt ?? new Date().toISOString();
    this._status = 'PAID';
    this._version++;
  }

  cancel(): void {
    if (this._status === 'PAID' || this._status === 'CANCELLED') {
      throw new Error(`Cannot cancel invoice in ${this._status} status`);
    }
    this._status = 'CANCELLED';
    this._version++;
  }

  convertToCreditNote(): void {
    if (this._status !== 'ISSUED' && this._status !== 'PAID') {
      throw new Error(`Cannot create credit note from ${this._status} status`);
    }
    this._status = 'CREDIT_NOTE';
    this._version++;
  }

  setEInvoiceIrn(irn: string): void {
    this._eInvoiceIrn = irn;
    this._version++;
  }

  setEWayBillNumber(billNumber: string): void {
    this._eWayBillNumber = billNumber;
    this._version++;
  }

  /**
   * Checks whether invoice is overdue.
   */
  isOverdue(): boolean {
    if (this._status === 'PAID' || this._status === 'CANCELLED' || this._status === 'CREDIT_NOTE') return false;
    return new Date(this._dueDate).getTime() < Date.now();
  }

  toJSON() {
    return {
      id: this.id,
      tenantId: this.tenantId,
      distributorId: this.distributorId,
      orderId: this.orderId,
      invoiceNumber: this.invoiceNumber,
      items: this._items,
      grossAmount: this._grossAmount,
      discountAmount: this._discountAmount,
      taxableAmount: this._taxableAmount,
      cgst: this._cgst,
      sgst: this._sgst,
      igst: this._igst,
      totalTax: this._totalTax,
      netAmount: this._netAmount,
      currency: this._currency,
      status: this._status,
      dueDate: this._dueDate,
      paidAt: this._paidAt,
      eInvoiceIrn: this._eInvoiceIrn,
      eWayBillNumber: this._eWayBillNumber,
      isOverdue: this.isOverdue(),
      version: this._version,
    };
  }
}
