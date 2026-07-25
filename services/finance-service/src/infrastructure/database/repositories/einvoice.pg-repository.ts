import { EInvoiceRepository, ListEInvoicesOptions } from '../../../domain/repositories/einvoice.repository.js';
import { EInvoice, EInvoiceDomainError } from '../../../domain/entities/einvoice.entity.js';

export class EInvoicePgRepository implements EInvoiceRepository {
  private static inMemoryDb = new Map<string, EInvoice>();

  constructor(private readonly dbPool?: any) {}

  async save(einvoice: EInvoice, tenantId: string): Promise<EInvoice> {
    if (einvoice.tenantId !== tenantId) {
      throw new EInvoiceDomainError(`Tenant mismatch: einvoice tenant '${einvoice.tenantId}' does not match context '${tenantId}'`);
    }

    if (this.dbPool) {
      const client = await this.dbPool.connect();
      try {
        await client.query("SELECT set_config('app.current_tenant_id', $1, true)", [tenantId]);
        const query = `
          INSERT INTO finance_einvoices (
            id, tenant_id, invoice_id, irn, qr_code, acknowledgement_number, acknowledgement_date,
            tax_amount_cents, total_amount_cents, status, idempotency_key, version, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
          RETURNING *;
        `;
        const values = [
          einvoice.id, einvoice.tenantId, einvoice.invoiceId, einvoice.irn, einvoice.qrCode || null,
          einvoice.acknowledgementNumber || null, einvoice.acknowledgementDate || null,
          einvoice.taxAmountCents, einvoice.totalAmountCents, einvoice.status, einvoice.idempotencyKey || null,
          einvoice.version, einvoice.createdAt, einvoice.updatedAt
        ];
        await client.query(query, values);
      } finally {
        client.release();
      }
    }

    EInvoicePgRepository.inMemoryDb.set(einvoice.id, einvoice);
    return einvoice;
  }

  async findById(id: string, tenantId: string): Promise<EInvoice | null> {
    if (this.dbPool) {
      const client = await this.dbPool.connect();
      try {
        await client.query("SELECT set_config('app.current_tenant_id', $1, true)", [tenantId]);
        const res = await client.query(
          'SELECT * FROM finance_einvoices WHERE id = $1 AND tenant_id = $2',
          [id, tenantId]
        );
        if (res.rows.length === 0) return null;
        return this.mapRowToEntity(res.rows[0]);
      } finally {
        client.release();
      }
    }

    const item = EInvoicePgRepository.inMemoryDb.get(id);
    if (!item || item.tenantId !== tenantId) return null;
    return item;
  }

  async findByIrn(irn: string, tenantId: string): Promise<EInvoice | null> {
    if (this.dbPool) {
      const client = await this.dbPool.connect();
      try {
        await client.query("SELECT set_config('app.current_tenant_id', $1, true)", [tenantId]);
        const res = await client.query(
          'SELECT * FROM finance_einvoices WHERE irn = $1 AND tenant_id = $2',
          [irn, tenantId]
        );
        if (res.rows.length === 0) return null;
        return this.mapRowToEntity(res.rows[0]);
      } finally {
        client.release();
      }
    }

    for (const einvoice of EInvoicePgRepository.inMemoryDb.values()) {
      if (einvoice.tenantId === tenantId && einvoice.irn === irn) {
        return einvoice;
      }
    }
    return null;
  }

  async list(tenantId: string, options?: ListEInvoicesOptions): Promise<{ items: EInvoice[]; total: number }> {
    const page = options?.page || 1;
    const limit = Math.min(options?.limit || 20, 100);
    const offset = (page - 1) * limit;

    if (this.dbPool) {
      const client = await this.dbPool.connect();
      try {
        await client.query("SELECT set_config('app.current_tenant_id', $1, true)", [tenantId]);
        let query = 'SELECT * FROM finance_einvoices WHERE tenant_id = $1';
        const params: any[] = [tenantId];

        if (options?.status) {
          params.push(options.status);
          query += ` AND status = $${params.length}`;
        }
        if (options?.invoiceId) {
          params.push(options.invoiceId);
          query += ` AND invoice_id = $${params.length}`;
        }

        query += ' ORDER BY created_at DESC LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2);
        params.push(limit, offset);

        const res = await client.query(query, params);
        const countRes = await client.query('SELECT COUNT(*) FROM finance_einvoices WHERE tenant_id = $1', [tenantId]);
        
        return {
          items: res.rows.map((row: any) => this.mapRowToEntity(row)),
          total: parseInt(countRes.rows[0].count, 10),
        };
      } finally {
        client.release();
      }
    }

    let items = Array.from(EInvoicePgRepository.inMemoryDb.values()).filter(r => r.tenantId === tenantId);

    if (options?.status) {
      items = items.filter(r => r.status === options.status);
    }
    if (options?.invoiceId) {
      items = items.filter(r => r.invoiceId === options.invoiceId);
    }

    const total = items.length;
    items = items.slice(offset, offset + limit);

    return { items, total };
  }

  async update(einvoice: EInvoice, tenantId: string): Promise<EInvoice> {
    const existing = await this.findById(einvoice.id, tenantId);
    if (!existing) {
      throw new EInvoiceDomainError(`EInvoice with id '${einvoice.id}' not found`);
    }

    if (existing.version !== einvoice.version) {
      throw new EInvoiceDomainError(
        `Optimistic concurrency conflict for EInvoice '${einvoice.id}': expected v${einvoice.version}, found v${existing.version}`
      );
    }

    const updatedEntity = new EInvoice({
      id: einvoice.id,
      tenantId: einvoice.tenantId,
      invoiceId: einvoice.invoiceId,
      irn: einvoice.irn,
      qrCode: einvoice.qrCode,
      acknowledgementNumber: einvoice.acknowledgementNumber,
      acknowledgementDate: einvoice.acknowledgementDate,
      taxAmountCents: einvoice.taxAmountCents,
      totalAmountCents: einvoice.totalAmountCents,
      status: einvoice.status,
      idempotencyKey: einvoice.idempotencyKey,
      version: existing.version + 1,
      createdAt: einvoice.createdAt,
      updatedAt: new Date(),
    });

    if (this.dbPool) {
      const client = await this.dbPool.connect();
      try {
        await client.query("SELECT set_config('app.current_tenant_id', $1, true)", [tenantId]);
        const query = `
          UPDATE finance_einvoices
          SET status = $1, version = version + 1, updated_at = CURRENT_TIMESTAMP
          WHERE id = $2 AND tenant_id = $3 AND version = $4
          RETURNING *;
        `;
        const res = await client.query(query, [einvoice.status, einvoice.id, tenantId, einvoice.version]);
        if (res.rows.length === 0) {
          throw new EInvoiceDomainError(`Update failed: Optimistic locking version conflict or EInvoice not found`);
        }
      } finally {
        client.release();
      }
    }

    EInvoicePgRepository.inMemoryDb.set(einvoice.id, updatedEntity);
    return updatedEntity;
  }

  async delete(id: string, tenantId: string): Promise<boolean> {
    const existing = await this.findById(id, tenantId);
    if (!existing) return false;

    if (this.dbPool) {
      const client = await this.dbPool.connect();
      try {
        await client.query("SELECT set_config('app.current_tenant_id', $1, true)", [tenantId]);
        await client.query('DELETE FROM finance_einvoices WHERE id = $1 AND tenant_id = $2', [id, tenantId]);
      } finally {
        client.release();
      }
    }

    EInvoicePgRepository.inMemoryDb.delete(id);
    return true;
  }

  public static clearInMemoryStore(): void {
    EInvoicePgRepository.inMemoryDb.clear();
  }

  private mapRowToEntity(row: any): EInvoice {
    return new EInvoice({
      id: row.id,
      tenantId: row.tenant_id,
      invoiceId: row.invoice_id,
      irn: row.irn,
      qrCode: row.qr_code,
      acknowledgementNumber: row.acknowledgement_number,
      acknowledgementDate: row.acknowledgement_date ? new Date(row.acknowledgement_date) : undefined,
      taxAmountCents: parseInt(row.tax_amount_cents, 10),
      totalAmountCents: parseInt(row.total_amount_cents, 10),
      status: row.status,
      idempotencyKey: row.idempotency_key,
      version: row.version,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    });
  }
}
