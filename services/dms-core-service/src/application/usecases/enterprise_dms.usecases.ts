import { DistributorHierarchy } from '../../domain/entities/distributor-hierarchy.js';
import { KYCDocument } from '../../domain/entities/kyc-document.js';
import { CreditLimit } from '../../domain/entities/credit-limit.js';
import { StockLedgerEntry } from '../../domain/entities/stock-ledger-entry.js';
import { StockTransfer } from '../../domain/entities/stock-transfer.js';
import { ProductCategory } from '../../domain/entities/product-category.js';
import { Batch } from '../../domain/entities/batch.js';
import { Invoice } from '../../domain/entities/invoice.js';
import { PriceList } from '../../domain/entities/price-list.js';
import { StructuredLogger } from '@dms/pkg-logger';

export class EnterpriseDmsUseCases {
  private logger = new StructuredLogger('EnterpriseDmsUseCases');

  // Simple in-memory stores for fallback if PG is not configured
  private static hierarchies = new Map<string, DistributorHierarchy>();
  private static kycDocuments = new Map<string, KYCDocument>();
  private static creditLimits = new Map<string, CreditLimit>();
  private static ledgerEntries: StockLedgerEntry[] = [];
  private static transfers = new Map<string, StockTransfer>();
  private static categories = new Map<string, ProductCategory>();
  private static batches = new Map<string, Batch>();
  private static invoices = new Map<string, Invoice>();
  private static priceLists = new Map<string, PriceList>();

  static clearStores() {
    this.hierarchies.clear();
    this.kycDocuments.clear();
    this.creditLimits.clear();
    this.ledgerEntries = [];
    this.transfers.clear();
    this.categories.clear();
    this.batches.clear();
    this.invoices.clear();
    this.priceLists.clear();
  }

  // ── DistributorHierarchy Use Cases ──────────────────────────────
  async createHierarchy(input: {
    id: string;
    tenantId: string;
    parentDistributorId: string;
    childDistributorId: string;
    hierarchyLevel: 'SUPER_STOCKIST' | 'CNF' | 'DISTRIBUTOR' | 'SUB_DISTRIBUTOR';
    territory: string;
    effectiveFrom: string;
    effectiveTo: string;
  }): Promise<DistributorHierarchy> {
    this.logger.info('Creating distributor hierarchy mapping', { parent: input.parentDistributorId, child: input.childDistributorId });
    const hierarchy = DistributorHierarchy.create({
      id: input.id,
      tenantId: input.tenantId,
      parentDistributorId: input.parentDistributorId,
      childDistributorId: input.childDistributorId,
      hierarchyLevel: input.hierarchyLevel,
      territory: input.territory,
      effectiveFrom: input.effectiveFrom,
      effectiveTo: input.effectiveTo,
    });
    EnterpriseDmsUseCases.hierarchies.set(hierarchy.id, hierarchy);
    return hierarchy;
  }

  // ── KYCDocument Use Cases ───────────────────────────────────────
  async uploadKYCDocument(input: {
    id: string;
    tenantId: string;
    distributorId: string;
    documentType: 'GSTIN' | 'PAN' | 'TRADE_LICENSE' | 'FSSAI' | 'DRUG_LICENSE' | 'BANK_PROOF';
    documentNumber: string;
    documentUrl: string;
    expiresAt?: string;
  }): Promise<KYCDocument> {
    this.logger.info('Uploading distributor KYC document', { type: input.documentType, number: input.documentNumber });
    const doc = KYCDocument.create({
      id: input.id,
      tenantId: input.tenantId,
      distributorId: input.distributorId,
      documentType: input.documentType,
      documentNumber: input.documentNumber,
      documentUrl: input.documentUrl,
      expiresAt: input.expiresAt,
    });
    EnterpriseDmsUseCases.kycDocuments.set(doc.id, doc);
    return doc;
  }

  async verifyKYCDocument(id: string, tenantId: string, verifiedBy: string, approve: boolean): Promise<KYCDocument> {
    const doc = EnterpriseDmsUseCases.kycDocuments.get(id);
    if (!doc || doc.tenantId !== tenantId) {
      throw new Error('KYC document not found');
    }
    if (approve) {
      doc.verify(verifiedBy);
    } else {
      doc.reject('Document content does not match registration info');
    }
    return doc;
  }

  // ── CreditLimit Use Cases ────────────────────────────────────────
  async createCreditLimit(input: {
    id: string;
    tenantId: string;
    distributorId: string;
    creditLimit: number;
    creditRating?: 'A' | 'B' | 'C' | 'D';
    paymentTermDays?: number;
  }): Promise<CreditLimit> {
    const cl = CreditLimit.create({
      id: input.id,
      tenantId: input.tenantId,
      distributorId: input.distributorId,
      creditLimit: input.creditLimit,
      creditRating: input.creditRating,
      paymentTermDays: input.paymentTermDays,
    });
    EnterpriseDmsUseCases.creditLimits.set(cl.id, cl);
    return cl;
  }

  async utilizeCredit(id: string, tenantId: string, amount: number): Promise<CreditLimit> {
    const cl = EnterpriseDmsUseCases.creditLimits.get(id);
    if (!cl || cl.tenantId !== tenantId) {
      throw new Error('Credit limit record not found');
    }
    cl.utilize(amount);
    return cl;
  }

  // ── StockLedger Use Cases ───────────────────────────────────────
  async recordLedgerEntry(input: {
    id: string;
    tenantId: string;
    productId: string;
    warehouseId: string;
    batchNumber: string;
    transactionType: 'INWARD' | 'OUTWARD' | 'ADJUSTMENT' | 'TRANSFER' | 'RETURN' | 'WRITE_OFF';
    quantity: number;
    runningBalance: number;
    referenceId: string;
    referenceType: 'ORDER' | 'TRANSFER' | 'RETURN' | 'MANUAL';
    createdBy: string;
  }): Promise<StockLedgerEntry> {
    const entry = StockLedgerEntry.create(input);
    EnterpriseDmsUseCases.ledgerEntries.push(entry);
    return entry;
  }

  async getLedger(productId: string, tenantId: string): Promise<StockLedgerEntry[]> {
    return EnterpriseDmsUseCases.ledgerEntries.filter(
      e => e.productId === productId && e.tenantId === tenantId
    );
  }

  // ── StockTransfer Use Cases ─────────────────────────────────────
  async requestTransfer(input: {
    id: string;
    tenantId: string;
    fromWarehouseId: string;
    toWarehouseId: string;
    items: Array<{ productId: string; batchNumber: string; quantity: number; expiryDate: string }>;
    requestedBy: string;
  }): Promise<StockTransfer> {
    const transfer = StockTransfer.create({
      id: input.id,
      tenantId: input.tenantId,
      fromWarehouseId: input.fromWarehouseId,
      toWarehouseId: input.toWarehouseId,
      items: input.items,
      requestedBy: input.requestedBy,
    });
    EnterpriseDmsUseCases.transfers.set(transfer.id, transfer);
    return transfer;
  }

  async approveTransfer(id: string, tenantId: string, approvedBy: string): Promise<StockTransfer> {
    const transfer = EnterpriseDmsUseCases.transfers.get(id);
    if (!transfer || transfer.tenantId !== tenantId) {
      throw new Error('Transfer request not found');
    }
    transfer.approve(approvedBy);
    return transfer;
  }

  async shipTransfer(id: string, tenantId: string): Promise<StockTransfer> {
    const transfer = EnterpriseDmsUseCases.transfers.get(id);
    if (!transfer || transfer.tenantId !== tenantId) {
      throw new Error('Transfer request not found');
    }
    transfer.markInTransit();
    return transfer;
  }

  async receiveTransfer(id: string, tenantId: string, receivedBy: string): Promise<StockTransfer> {
    const transfer = EnterpriseDmsUseCases.transfers.get(id);
    if (!transfer || transfer.tenantId !== tenantId) {
      throw new Error('Transfer request not found');
    }
    transfer.receive(
      receivedBy,
      transfer.items.map(item => ({
        productId: item.productId,
        batchNumber: item.batchNumber,
        receivedQuantity: item.quantity
      }))
    );
    transfer.close();
    return transfer;
  }

  // ── ProductCategory Use Cases ───────────────────────────────────
  async createCategory(input: {
    id: string;
    tenantId: string;
    name: string;
    parentCategoryId?: string;
    level: number;
    sortOrder: number;
  }): Promise<ProductCategory> {
    const cat = ProductCategory.create(input);
    EnterpriseDmsUseCases.categories.set(cat.id, cat);
    return cat;
  }

  // ── Batch Use Cases ─────────────────────────────────────────────
  async createBatch(input: {
    id: string;
    tenantId: string;
    productId: string;
    batchNumber: string;
    manufacturingDate: string;
    expiryDate: string;
    quantity: number;
  }): Promise<Batch> {
    const batch = Batch.create({
      id: input.id,
      tenantId: input.tenantId,
      productId: input.productId,
      batchNumber: input.batchNumber,
      manufacturingDate: input.manufacturingDate,
      expiryDate: input.expiryDate,
      quantity: input.quantity,
    });
    EnterpriseDmsUseCases.batches.set(batch.id, batch);
    return batch;
  }

  // ── Invoice Use Cases ───────────────────────────────────────────
  async generateInvoice(input: {
    id: string;
    tenantId: string;
    distributorId: string;
    orderId?: string;
    invoiceNumber: string;
    items: Array<{
      productId: string;
      quantity: number;
      unitPrice: number;
      discountAmount: number;
      taxableAmount: number;
      taxRatePct: number;
      taxAmount: number;
      totalAmount: number;
    }>;
    dueDate: string;
  }): Promise<Invoice> {
    // Calculate sums
    let grossAmount = 0;
    let discountAmount = 0;
    let taxableAmount = 0;
    let totalTax = 0;
    let netAmount = 0;

    for (const item of input.items) {
      grossAmount += item.quantity * item.unitPrice;
      discountAmount += item.discountAmount;
      taxableAmount += item.taxableAmount;
      totalTax += item.taxAmount;
      netAmount += item.totalAmount;
    }

    const invoice = Invoice.create({
      id: input.id,
      tenantId: input.tenantId,
      distributorId: input.distributorId,
      orderId: input.orderId,
      invoiceNumber: input.invoiceNumber,
      items: input.items,
      grossAmount,
      discountAmount,
      taxableAmount,
      cgst: Math.round(totalTax / 2),
      sgst: Math.round(totalTax / 2),
      igst: 0,
      totalTax,
      netAmount,
      dueDate: input.dueDate,
    });
    EnterpriseDmsUseCases.invoices.set(invoice.id, invoice);
    return invoice;
  }

  async issueInvoice(id: string, tenantId: string): Promise<Invoice> {
    const invoice = EnterpriseDmsUseCases.invoices.get(id);
    if (!invoice || invoice.tenantId !== tenantId) {
      throw new Error('Invoice not found');
    }
    invoice.issue();
    invoice.setEInvoiceIrn(`IRN-${invoice.invoiceNumber}-AUTO-9923`);
    invoice.setEWayBillNumber(`EWAY-${invoice.invoiceNumber}-882`);
    return invoice;
  }
}
