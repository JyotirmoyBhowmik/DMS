import { EnterpriseDmsUseCases } from '../../../application/usecases/enterprise_dms.usecases.js';
import { DistributorController } from './distributor.controller.js';
import { StructuredLogger } from '@dms/pkg-logger';

export class EnterpriseDmsController {
  private useCases = new EnterpriseDmsUseCases();
  private logger = new StructuredLogger('EnterpriseDmsController');

  async handleCreateHierarchy(body: {
    id: string;
    parentDistributorId: string;
    childDistributorId: string;
    hierarchyLevel: 'SUPER_STOCKIST' | 'CNF' | 'DISTRIBUTOR' | 'SUB_DISTRIBUTOR';
    territory: string;
    effectiveFrom: string;
    effectiveTo: string;
  }, headers: Record<string, string | undefined>): Promise<{ status: number; body: Record<string, unknown> }> {
    const tenantId = headers['x-tenant-id'] || '00000000-0000-0000-0000-000000000001';
    try {
      const h = await this.useCases.createHierarchy({ ...body, tenantId });
      return {
        status: 201,
        body: { success: true, hierarchy: h.toJSON() }
      };
    } catch (err: any) {
      return {
        status: 400,
        body: { success: false, error: err.message }
      };
    }
  }

  async handleUploadKYCDocument(body: {
    id: string;
    distributorId: string;
    documentType: 'GSTIN' | 'PAN' | 'TRADE_LICENSE' | 'FSSAI' | 'DRUG_LICENSE' | 'BANK_PROOF';
    documentNumber: string;
    documentUrl: string;
    expiresAt?: string;
  }, headers: Record<string, string | undefined>): Promise<{ status: number; body: Record<string, unknown> }> {
    const tenantId = headers['x-tenant-id'] || '00000000-0000-0000-0000-000000000001';
    try {
      const doc = await this.useCases.uploadKYCDocument({ ...body, tenantId });
      return {
        status: 201,
        body: { success: true, document: doc.toJSON() }
      };
    } catch (err: any) {
      return {
        status: 400,
        body: { success: false, error: err.message }
      };
    }
  }

  async handleVerifyKYCDocument(body: {
    id: string;
    verifiedBy: string;
    approve: boolean;
  }, headers: Record<string, string | undefined>): Promise<{ status: number; body: Record<string, unknown> }> {
    const tenantId = headers['x-tenant-id'] || '00000000-0000-0000-0000-000000000001';
    try {
      const doc = await this.useCases.verifyKYCDocument(body.id, tenantId, body.verifiedBy, body.approve);
      return {
        status: 200,
        body: { success: true, document: doc.toJSON() }
      };
    } catch (err: any) {
      return {
        status: 400,
        body: { success: false, error: err.message }
      };
    }
  }

  async handleCreateCreditLimit(body: {
    id: string;
    distributorId: string;
    creditLimit: number;
    creditRating?: 'A' | 'B' | 'C' | 'D';
    paymentTermDays?: number;
  }, headers: Record<string, string | undefined>): Promise<{ status: number; body: Record<string, unknown> }> {
    const tenantId = headers['x-tenant-id'] || '00000000-0000-0000-0000-000000000001';
    try {
      const cl = await this.useCases.createCreditLimit({ ...body, tenantId });
      return {
        status: 201,
        body: { success: true, creditLimit: cl.toJSON() }
      };
    } catch (err: any) {
      return {
        status: 400,
        body: { success: false, error: err.message }
      };
    }
  }

  async handleUtilizeCredit(body: {
    id: string;
    amount: number;
  }, headers: Record<string, string | undefined>): Promise<{ status: number; body: Record<string, unknown> }> {
    const tenantId = headers['x-tenant-id'] || '00000000-0000-0000-0000-000000000001';
    try {
      const cl = await this.useCases.utilizeCredit(body.id, tenantId, body.amount);
      return {
        status: 200,
        body: { success: true, creditLimit: cl.toJSON() }
      };
    } catch (err: any) {
      return {
        status: 400,
        body: { success: false, error: err.message }
      };
    }
  }

  async handleRecordLedgerEntry(body: {
    id: string;
    productId: string;
    warehouseId: string;
    batchNumber: string;
    transactionType: 'INWARD' | 'OUTWARD' | 'ADJUSTMENT' | 'TRANSFER' | 'RETURN' | 'WRITE_OFF';
    quantity: number;
    runningBalance: number;
    referenceId: string;
    referenceType: 'ORDER' | 'TRANSFER' | 'RETURN' | 'MANUAL';
    createdBy: string;
  }, headers: Record<string, string | undefined>): Promise<{ status: number; body: Record<string, unknown> }> {
    const tenantId = headers['x-tenant-id'] || '00000000-0000-0000-0000-000000000001';
    try {
      const entry = await this.useCases.recordLedgerEntry({ ...body, tenantId });
      return {
        status: 201,
        body: { success: true, entry: entry.toJSON() }
      };
    } catch (err: any) {
      return {
        status: 400,
        body: { success: false, error: err.message }
      };
    }
  }

  async handleGetLedger(productId: string, headers: Record<string, string | undefined>): Promise<{ status: number; body: Record<string, unknown> }> {
    const tenantId = headers['x-tenant-id'] || '00000000-0000-0000-0000-000000000001';
    try {
      const ledger = await this.useCases.getLedger(productId, tenantId);
      return {
        status: 200,
        body: { success: true, items: ledger.map(e => e.toJSON()) }
      };
    } catch (err: any) {
      return {
        status: 400,
        body: { success: false, error: err.message }
      };
    }
  }

  async handleRequestTransfer(body: {
    id: string;
    fromWarehouseId: string;
    toWarehouseId: string;
    items: Array<{ productId: string; batchNumber: string; quantity: number; expiryDate: string }>;
    requestedBy: string;
  }, headers: Record<string, string | undefined>): Promise<{ status: number; body: Record<string, unknown> }> {
    const tenantId = headers['x-tenant-id'] || '00000000-0000-0000-0000-000000000001';
    try {
      const transfer = await this.useCases.requestTransfer({ ...body, tenantId });
      return {
        status: 201,
        body: { success: true, transfer: transfer.toJSON() }
      };
    } catch (err: any) {
      return {
        status: 400,
        body: { success: false, error: err.message }
      };
    }
  }

  async handleApproveTransfer(body: {
    id: string;
    approvedBy: string;
  }, headers: Record<string, string | undefined>): Promise<{ status: number; body: Record<string, unknown> }> {
    const tenantId = headers['x-tenant-id'] || '00000000-0000-0000-0000-000000000001';
    try {
      const transfer = await this.useCases.approveTransfer(body.id, tenantId, body.approvedBy);
      return {
        status: 200,
        body: { success: true, transfer: transfer.toJSON() }
      };
    } catch (err: any) {
      return {
        status: 400,
        body: { success: false, error: err.message }
      };
    }
  }

  async handleShipTransfer(body: {
    id: string;
  }, headers: Record<string, string | undefined>): Promise<{ status: number; body: Record<string, unknown> }> {
    const tenantId = headers['x-tenant-id'] || '00000000-0000-0000-0000-000000000001';
    try {
      const transfer = await this.useCases.shipTransfer(body.id, tenantId);
      return {
        status: 200,
        body: { success: true, transfer: transfer.toJSON() }
      };
    } catch (err: any) {
      return {
        status: 400,
        body: { success: false, error: err.message }
      };
    }
  }

  async handleReceiveTransfer(body: {
    id: string;
    receivedBy: string;
  }, headers: Record<string, string | undefined>): Promise<{ status: number; body: Record<string, unknown> }> {
    const tenantId = headers['x-tenant-id'] || '00000000-0000-0000-0000-000000000001';
    try {
      const transfer = await this.useCases.receiveTransfer(body.id, tenantId, body.receivedBy);
      return {
        status: 200,
        body: { success: true, transfer: transfer.toJSON() }
      };
    } catch (err: any) {
      return {
        status: 400,
        body: { success: false, error: err.message }
      };
    }
  }

  async handleCreateCategory(body: {
    id: string;
    name: string;
    parentCategoryId?: string;
    level: number;
    sortOrder: number;
  }, headers: Record<string, string | undefined>): Promise<{ status: number; body: Record<string, unknown> }> {
    const tenantId = headers['x-tenant-id'] || '00000000-0000-0000-0000-000000000001';
    try {
      const cat = await this.useCases.createCategory({ ...body, tenantId });
      return {
        status: 201,
        body: { success: true, category: cat.toJSON() }
      };
    } catch (err: any) {
      return {
        status: 400,
        body: { success: false, error: err.message }
      };
    }
  }

  async handleCreateBatch(body: {
    id: string;
    productId: string;
    batchNumber: string;
    manufacturingDate: string;
    expiryDate: string;
    quantity: number;
  }, headers: Record<string, string | undefined>): Promise<{ status: number; body: Record<string, unknown> }> {
    const tenantId = headers['x-tenant-id'] || '00000000-0000-0000-0000-000000000001';
    try {
      const batch = await this.useCases.createBatch({ ...body, tenantId });
      return {
        status: 201,
        body: { success: true, batch: batch.toJSON() }
      };
    } catch (err: any) {
      return {
        status: 400,
        body: { success: false, error: err.message }
      };
    }
  }

  async handleGenerateInvoice(body: {
    id: string;
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
  }, headers: Record<string, string | undefined>): Promise<{ status: number; body: Record<string, unknown> }> {
    const tenantId = headers['x-tenant-id'] || '00000000-0000-0000-0000-000000000001';
    try {
      const inv = await this.useCases.generateInvoice({ ...body, tenantId });
      return {
        status: 201,
        body: { success: true, invoice: inv.toJSON() }
      };
    } catch (err: any) {
      return {
        status: 400,
        body: { success: false, error: err.message }
      };
    }
  }

  async handleIssueInvoice(body: {
    id: string;
  }, headers: Record<string, string | undefined>): Promise<{ status: number; body: Record<string, unknown> }> {
    const tenantId = headers['x-tenant-id'] || '00000000-0000-0000-0000-000000000001';
    try {
      const inv = await this.useCases.issueInvoice(body.id, tenantId);
      return {
        status: 200,
        body: { success: true, invoice: inv.toJSON() }
      };
    } catch (err: any) {
      return {
        status: 400,
        body: { success: false, error: err.message }
      };
    }
  }

  async handleAdjustStock(body: {
    id: string;
    productId: string;
    warehouseId: string;
    batchNumber: string;
    transactionType: 'INWARD' | 'OUTWARD' | 'ADJUSTMENT' | 'TRANSFER' | 'RETURN' | 'WRITE_OFF';
    quantity: number;
    referenceId: string;
    referenceType: 'ORDER' | 'TRANSFER' | 'RETURN' | 'MANUAL';
    createdBy: string;
    expiryDate?: string;
  }, headers: Record<string, string | undefined>): Promise<{ status: number; body: Record<string, unknown> }> {
    const tenantId = headers['x-tenant-id'] || '00000000-0000-0000-0000-000000000001';
    try {
      const entry = await this.useCases.adjustStock({ ...body, tenantId });
      return {
        status: 200,
        body: { success: true, entry: entry.toJSON() }
      };
    } catch (err: any) {
      return {
        status: 400,
        body: { success: false, error: err.message }
      };
    }
  }

  async handleAllocateStockFEFO(body: {
    productId: string;
    warehouseId: string;
    quantity: number;
    referenceId: string;
    referenceType: 'ORDER' | 'TRANSFER' | 'RETURN' | 'MANUAL';
    createdBy: string;
  }, headers: Record<string, string | undefined>): Promise<{ status: number; body: Record<string, unknown> }> {
    const tenantId = headers['x-tenant-id'] || '00000000-0000-0000-0000-000000000001';
    try {
      const result = await this.useCases.allocateStockFEFO({ ...body, tenantId });
      return {
        status: 200,
        body: { success: true, ...result }
      };
    } catch (err: any) {
      return {
        status: 400,
        body: { success: false, error: err.message }
      };
    }
  }

  async handleGetNearExpiryAlerts(query: {
    days?: number;
  }, headers: Record<string, string | undefined>): Promise<{ status: number; body: Record<string, unknown> }> {
    const tenantId = headers['x-tenant-id'] || '00000000-0000-0000-0000-000000000001';
    try {
      const alerts = await this.useCases.getNearExpiryAlerts(tenantId, query.days);
      return {
        status: 200,
        body: { success: true, alerts: alerts.map(b => b.toJSON()) }
      };
    } catch (err: any) {
      return {
        status: 400,
        body: { success: false, error: err.message }
      };
    }
  }

  async handleReconcileStock(body: {
    productId: string;
    warehouseId: string;
  }, headers: Record<string, string | undefined>): Promise<{ status: number; body: Record<string, unknown> }> {
    const tenantId = headers['x-tenant-id'] || '00000000-0000-0000-0000-000000000001';
    try {
      const result = await this.useCases.reconcileStock(tenantId, body.productId, body.warehouseId);
      return {
        status: 200,
        body: { success: true, ...result }
      };
    } catch (err: any) {
      return {
        status: 400,
        body: { success: false, error: err.message }
      };
    }
  }

  // ── Distributor CRUD Delegation ──
  private distributorController = new DistributorController();

  async handleCreateDistributor(body: any, headers: Record<string, string | undefined>) {
    const res = await this.distributorController.handleCreate(body, headers);
    return { status: res.statusCode, body: res.body };
  }

  async handleUpdateDistributor(id: string, body: any, headers: Record<string, string | undefined>) {
    const res = await this.distributorController.handleUpdate(id, body, headers);
    return { status: res.statusCode, body: res.body };
  }

  async handleGetDistributor(id: string, headers: Record<string, string | undefined>) {
    const res = await this.distributorController.handleGet(id, headers);
    return { status: res.statusCode, body: res.body };
  }

  async handleListDistributors(query: any, headers: Record<string, string | undefined>) {
    const res = await this.distributorController.handleList(query, headers);
    return { status: res.statusCode, body: res.body };
  }

  async handleDeleteDistributor(id: string, headers: Record<string, string | undefined>) {
    const res = await this.distributorController.handleDelete(id, headers);
    return { status: res.statusCode, body: res.body };
  }
}

export * from './distributor-onboarding.controller.js';
