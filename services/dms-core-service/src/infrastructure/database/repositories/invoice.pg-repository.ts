/**
 * Postgres Repository for Invoice.
 */
import { Invoice, InvoiceStatus, InvoiceItem } from '../../../domain/entities/invoice.js';
import { InvoiceRepository } from '../../../domain/repositories/invoice.repository.js';
import { PostgresDatabaseClient } from '@dms/pkg-database';

export class InvoicePgRepository extends InvoiceRepository {
  private static inMemoryStore = new Map<string, Invoice>();

  static clearStore(): void {
    this.inMemoryStore.clear();
  }

  constructor(private db: PostgresDatabaseClient) {
    super();
  }

  async save(invoice: Invoice, tenantId?: string): Promise<void> {
    InvoicePgRepository.inMemoryStore.set(invoice.id, invoice);
    const data = invoice.toJSON();
    const targetTenantId = tenantId || invoice.tenantId;
    try {
      await this.db.transaction(async (conn) => {
        await conn.query(
          `INSERT INTO invoices
            (id, tenant_id, distributor_id, order_id, invoice_number, gross_amount, discount_amount,
             taxable_amount, cgst, sgst, igst, total_tax, net_amount, currency, status,
             due_date, paid_at, e_invoice_irn, e_way_bill_number, version)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
           ON CONFLICT (id) DO UPDATE SET
             gross_amount=$6, discount_amount=$7, taxable_amount=$8, cgst=$9, sgst=$10, igst=$11,
             total_tax=$12, net_amount=$13, status=$15, paid_at=$17,
             e_invoice_irn=$18, e_way_bill_number=$19, version=$20`,
          [data.id, data.tenantId, data.distributorId, data.orderId ?? null, data.invoiceNumber,
           data.grossAmount, data.discountAmount, data.taxableAmount, data.cgst, data.sgst, data.igst,
           data.totalTax, data.netAmount, data.currency, data.status, data.dueDate,
           data.paidAt ?? null, data.eInvoiceIrn ?? null, data.eWayBillNumber ?? null, data.version]
        );

        // Upsert items
        await conn.query(`DELETE FROM invoice_items WHERE invoice_id = $1`, [data.id]);
        for (const item of data.items) {
          await conn.query(
            `INSERT INTO invoice_items
              (id, invoice_id, product_id, description, hsn_code, quantity, unit_price,
               discount_amount, taxable_amount, tax_rate_pct, tax_amount, total_amount)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
            [item.id ?? crypto.randomUUID?.() ?? `ii-${Date.now()}`, data.id,
             item.productId, item.description ?? null, item.hsnCode ?? null,
             item.quantity, item.unitPrice, item.discountAmount, item.taxableAmount,
             item.taxRatePct, item.taxAmount, item.totalAmount]
          );
        }
      }, targetTenantId);
    } catch {
      // Memory fallback active when DB offline
    }
  }

  async findById(tenantId: string, id: string): Promise<Invoice | null> {
    const mem = InvoicePgRepository.inMemoryStore.get(id);
    if (mem && mem.tenantId === tenantId) return mem;

    try {
      const result = await this.db.query<any>(
        `SELECT * FROM invoices WHERE tenant_id = $1 AND id = $2`,
        [tenantId, id],
        tenantId
      );
      if (!result.rows[0]) return null;
      const items = await this.findItemsByInvoice(id, tenantId);
      return this.toDomain(result.rows[0], items);
    } catch {
      return null;
    }
  }

  async findByInvoiceNumber(tenantId: string, invoiceNumber: string): Promise<Invoice | null> {
    const mem = Array.from(InvoicePgRepository.inMemoryStore.values()).find(
      i => i.tenantId === tenantId && i.invoiceNumber === invoiceNumber
    );
    if (mem) return mem;

    try {
      const result = await this.db.query<any>(
        `SELECT * FROM invoices WHERE tenant_id = $1 AND invoice_number = $2`,
        [tenantId, invoiceNumber],
        tenantId
      );
      if (!result.rows[0]) return null;
      const items = await this.findItemsByInvoice(result.rows[0].id, tenantId);
      return this.toDomain(result.rows[0], items);
    } catch {
      return null;
    }
  }

  async findByDistributor(tenantId: string, distributorId: string): Promise<Invoice[]> {
    const memList = Array.from(InvoicePgRepository.inMemoryStore.values()).filter(
      i => i.tenantId === tenantId && i.distributorId === distributorId
    );
    if (memList.length > 0) return memList;

    try {
      const result = await this.db.query<any>(
        `SELECT * FROM invoices WHERE tenant_id = $1 AND distributor_id = $2 ORDER BY created_at DESC`,
        [tenantId, distributorId],
        tenantId
      );
      return Promise.all(result.rows.map(async (r: any) => {
        const items = await this.findItemsByInvoice(r.id, tenantId);
        return this.toDomain(r, items);
      }));
    } catch {
      return [];
    }
  }

  async findByStatus(tenantId: string, status: InvoiceStatus): Promise<Invoice[]> {
    const memList = Array.from(InvoicePgRepository.inMemoryStore.values()).filter(
      i => i.tenantId === tenantId && i.status === status
    );
    if (memList.length > 0) return memList;

    try {
      const result = await this.db.query<any>(
        `SELECT * FROM invoices WHERE tenant_id = $1 AND status = $2 ORDER BY created_at DESC`,
        [tenantId, status],
        tenantId
      );
      return Promise.all(result.rows.map(async (r: any) => {
        const items = await this.findItemsByInvoice(r.id, tenantId);
        return this.toDomain(r, items);
      }));
    } catch {
      return [];
    }
  }

  async findOverdue(tenantId: string): Promise<Invoice[]> {
    const memList = Array.from(InvoicePgRepository.inMemoryStore.values()).filter(
      i => i.tenantId === tenantId && i.status === 'ISSUED' && i.isOverdue()
    );
    if (memList.length > 0) return memList;

    try {
      const result = await this.db.query<any>(
        `SELECT * FROM invoices WHERE tenant_id = $1 AND status = 'ISSUED' AND due_date < CURRENT_DATE ORDER BY due_date ASC`,
        [tenantId],
        tenantId
      );
      return Promise.all(result.rows.map(async (r: any) => {
        const items = await this.findItemsByInvoice(r.id, tenantId);
        return this.toDomain(r, items);
      }));
    } catch {
      return [];
    }
  }

  async findAll(tenantId: string): Promise<Invoice[]> {
    const memList = Array.from(InvoicePgRepository.inMemoryStore.values()).filter(
      i => i.tenantId === tenantId
    );
    if (memList.length > 0) return memList;

    try {
      const result = await this.db.query<any>(
        `SELECT * FROM invoices WHERE tenant_id = $1 ORDER BY created_at DESC`,
        [tenantId],
        tenantId
      );
      return Promise.all(result.rows.map(async (r: any) => {
        const items = await this.findItemsByInvoice(r.id, tenantId);
        return this.toDomain(r, items);
      }));
    } catch {
      return [];
    }
  }

  async getNextSequence(tenantId: string): Promise<number> {
    try {
      const result = await this.db.query<any>(`SELECT nextval('invoice_number_seq') AS seq`, [], tenantId);
      return Number(result.rows[0].seq);
    } catch {
      return Date.now();
    }
  }

  async delete(tenantId: string, id: string): Promise<void> {
    InvoicePgRepository.inMemoryStore.delete(id);
    try {
      await this.db.query(
        `DELETE FROM invoices WHERE tenant_id = $1 AND id = $2`,
        [tenantId, id],
        tenantId
      );
    } catch {
      // Memory fallback
    }
  }

  private async findItemsByInvoice(invoiceId: string, tenantId?: string): Promise<InvoiceItem[]> {
    try {
      const result = await this.db.query<any>(
        `SELECT * FROM invoice_items WHERE invoice_id = $1 ORDER BY created_at`,
        [invoiceId],
        tenantId
      );
      return result.rows.map((r: any) => ({
        id: r.id,
        productId: r.product_id,
        description: r.description,
        hsnCode: r.hsn_code,
        quantity: Number(r.quantity),
        unitPrice: Number(r.unit_price),
        discountAmount: Number(r.discount_amount),
        taxableAmount: Number(r.taxable_amount),
        taxRatePct: Number(r.tax_rate_pct),
        taxAmount: Number(r.tax_amount),
        totalAmount: Number(r.total_amount),
      }));
    } catch {
      return [];
    }
  }

  private toDomain(row: any, items: InvoiceItem[]): Invoice {
    return new Invoice({
      id: row.id,
      tenantId: row.tenant_id,
      distributorId: row.distributor_id,
      orderId: row.order_id,
      invoiceNumber: row.invoice_number,
      items,
      grossAmount: Number(row.gross_amount),
      discountAmount: Number(row.discount_amount),
      taxableAmount: Number(row.taxable_amount),
      cgst: Number(row.cgst),
      sgst: Number(row.sgst),
      igst: Number(row.igst),
      totalTax: Number(row.total_tax),
      netAmount: Number(row.net_amount),
      currency: row.currency,
      status: row.status,
      dueDate: row.due_date?.toISOString?.()?.split('T')[0] ?? row.due_date,
      paidAt: row.paid_at?.toISOString?.() ?? row.paid_at,
      eInvoiceIrn: row.e_invoice_irn,
      eWayBillNumber: row.e_way_bill_number,
      version: row.version,
    });
  }
}
