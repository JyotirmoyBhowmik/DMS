/**
 * Postgres Repository for Invoice.
 */
import { Invoice, InvoiceStatus, InvoiceItem } from '../../../domain/entities/invoice.js';
import { InvoiceRepository } from '../../../domain/repositories/invoice.repository.js';

export class InvoicePgRepository extends InvoiceRepository {
  constructor(private pool: any) {
    super();
  }

  async save(invoice: Invoice): Promise<void> {
    const data = invoice.toJSON();
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      await client.query(
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
      await client.query(`DELETE FROM invoice_items WHERE invoice_id = $1`, [data.id]);
      for (const item of data.items) {
        await client.query(
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

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async findById(tenantId: string, id: string): Promise<Invoice | null> {
    const result = await this.pool.query(
      `SELECT * FROM invoices WHERE tenant_id = $1 AND id = $2`,
      [tenantId, id]
    );
    if (!result.rows[0]) return null;
    const items = await this.findItemsByInvoice(id);
    return this.toDomain(result.rows[0], items);
  }

  async findByInvoiceNumber(tenantId: string, invoiceNumber: string): Promise<Invoice | null> {
    const result = await this.pool.query(
      `SELECT * FROM invoices WHERE tenant_id = $1 AND invoice_number = $2`,
      [tenantId, invoiceNumber]
    );
    if (!result.rows[0]) return null;
    const items = await this.findItemsByInvoice(result.rows[0].id);
    return this.toDomain(result.rows[0], items);
  }

  async findByDistributor(tenantId: string, distributorId: string): Promise<Invoice[]> {
    const result = await this.pool.query(
      `SELECT * FROM invoices WHERE tenant_id = $1 AND distributor_id = $2 ORDER BY created_at DESC`,
      [tenantId, distributorId]
    );
    return Promise.all(result.rows.map(async (r: any) => {
      const items = await this.findItemsByInvoice(r.id);
      return this.toDomain(r, items);
    }));
  }

  async findByStatus(tenantId: string, status: InvoiceStatus): Promise<Invoice[]> {
    const result = await this.pool.query(
      `SELECT * FROM invoices WHERE tenant_id = $1 AND status = $2 ORDER BY created_at DESC`,
      [tenantId, status]
    );
    return Promise.all(result.rows.map(async (r: any) => {
      const items = await this.findItemsByInvoice(r.id);
      return this.toDomain(r, items);
    }));
  }

  async findOverdue(tenantId: string): Promise<Invoice[]> {
    const result = await this.pool.query(
      `SELECT * FROM invoices WHERE tenant_id = $1 AND status = 'ISSUED' AND due_date < CURRENT_DATE ORDER BY due_date ASC`,
      [tenantId]
    );
    return Promise.all(result.rows.map(async (r: any) => {
      const items = await this.findItemsByInvoice(r.id);
      return this.toDomain(r, items);
    }));
  }

  async findAll(tenantId: string): Promise<Invoice[]> {
    const result = await this.pool.query(
      `SELECT * FROM invoices WHERE tenant_id = $1 ORDER BY created_at DESC`,
      [tenantId]
    );
    return Promise.all(result.rows.map(async (r: any) => {
      const items = await this.findItemsByInvoice(r.id);
      return this.toDomain(r, items);
    }));
  }

  async getNextSequence(tenantId: string): Promise<number> {
    const result = await this.pool.query(`SELECT nextval('invoice_number_seq') AS seq`);
    return Number(result.rows[0].seq);
  }

  async delete(tenantId: string, id: string): Promise<void> {
    await this.pool.query(
      `DELETE FROM invoices WHERE tenant_id = $1 AND id = $2`,
      [tenantId, id]
    );
  }

  private async findItemsByInvoice(invoiceId: string): Promise<InvoiceItem[]> {
    const result = await this.pool.query(
      `SELECT * FROM invoice_items WHERE invoice_id = $1 ORDER BY created_at`,
      [invoiceId]
    );
    return result.rows.map((r: any) => ({
      id: r.id,
      productId: r.product_id,
      description: r.description,
      hsnCode: r.hsn_code,
      quantity: r.quantity,
      unitPrice: Number(r.unit_price),
      discountAmount: Number(r.discount_amount),
      taxableAmount: Number(r.taxable_amount),
      taxRatePct: Number(r.tax_rate_pct),
      taxAmount: Number(r.tax_amount),
      totalAmount: Number(r.total_amount),
    }));
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
