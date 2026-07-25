import { TaxFilingRepository, ListTaxFilingsOptions } from '../../../domain/repositories/tax-filing.repository.js';
import { TaxFiling, TaxFilingDomainError } from '../../../domain/entities/tax-filing.entity.js';

export class TaxFilingPgRepository implements TaxFilingRepository {
  private static inMemoryDb = new Map<string, TaxFiling>();

  constructor(private readonly dbPool?: any) {}

  async save(taxFiling: TaxFiling, tenantId: string): Promise<TaxFiling> {
    if (taxFiling.tenantId !== tenantId) {
      throw new TaxFilingDomainError(`Tenant mismatch: TaxFiling tenant '${taxFiling.tenantId}' does not match context '${tenantId}'`);
    }

    if (this.dbPool) {
      const client = await this.dbPool.connect();
      try {
        await client.query("SELECT set_config('app.current_tenant_id', $1, true)", [tenantId]);
        const query = `
          INSERT INTO finance_tax_filings (
            id, tenant_id, period, tax_type, taxable_amount_cents, tax_amount_cents,
            status, acknowledgement_number, filing_date, idempotency_key, version, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
          RETURNING *;
        `;
        const values = [
          taxFiling.id, taxFiling.tenantId, taxFiling.period, taxFiling.taxType,
          taxFiling.taxableAmountCents, taxFiling.taxAmountCents, taxFiling.status,
          taxFiling.acknowledgementNumber || null, taxFiling.filingDate || null,
          taxFiling.idempotencyKey || null, taxFiling.version, taxFiling.createdAt, taxFiling.updatedAt
        ];
        await client.query(query, values);
      } finally {
        client.release();
      }
    }

    TaxFilingPgRepository.inMemoryDb.set(taxFiling.id, taxFiling);
    return taxFiling;
  }

  async findById(id: string, tenantId: string): Promise<TaxFiling | null> {
    if (this.dbPool) {
      const client = await this.dbPool.connect();
      try {
        await client.query("SELECT set_config('app.current_tenant_id', $1, true)", [tenantId]);
        const res = await client.query(
          'SELECT * FROM finance_tax_filings WHERE id = $1 AND tenant_id = $2',
          [id, tenantId]
        );
        if (res.rows.length === 0) return null;
        return this.mapRowToEntity(res.rows[0]);
      } finally {
        client.release();
      }
    }

    const item = TaxFilingPgRepository.inMemoryDb.get(id);
    if (!item || item.tenantId !== tenantId) return null;
    return item;
  }

  async findByPeriodAndType(period: string, taxType: string, tenantId: string): Promise<TaxFiling | null> {
    if (this.dbPool) {
      const client = await this.dbPool.connect();
      try {
        await client.query("SELECT set_config('app.current_tenant_id', $1, true)", [tenantId]);
        const res = await client.query(
          'SELECT * FROM finance_tax_filings WHERE period = $1 AND tax_type = $2 AND tenant_id = $3',
          [period, taxType, tenantId]
        );
        if (res.rows.length === 0) return null;
        return this.mapRowToEntity(res.rows[0]);
      } finally {
        client.release();
      }
    }

    for (const item of TaxFilingPgRepository.inMemoryDb.values()) {
      if (item.tenantId === tenantId && item.period === period && item.taxType === taxType) {
        return item;
      }
    }
    return null;
  }

  async list(tenantId: string, options?: ListTaxFilingsOptions): Promise<{ items: TaxFiling[]; total: number }> {
    const page = options?.page || 1;
    const limit = Math.min(options?.limit || 20, 100);
    const offset = (page - 1) * limit;

    if (this.dbPool) {
      const client = await this.dbPool.connect();
      try {
        await client.query("SELECT set_config('app.current_tenant_id', $1, true)", [tenantId]);
        let query = 'SELECT * FROM finance_tax_filings WHERE tenant_id = $1';
        const params: any[] = [tenantId];

        if (options?.status) {
          params.push(options.status);
          query += ` AND status = $${params.length}`;
        }
        if (options?.period) {
          params.push(options.period);
          query += ` AND period = $${params.length}`;
        }

        query += ' ORDER BY created_at DESC LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2);
        params.push(limit, offset);

        const res = await client.query(query, params);
        const countRes = await client.query('SELECT COUNT(*) FROM finance_tax_filings WHERE tenant_id = $1', [tenantId]);
        
        return {
          items: res.rows.map((row: any) => this.mapRowToEntity(row)),
          total: parseInt(countRes.rows[0].count, 10),
        };
      } finally {
        client.release();
      }
    }

    let items = Array.from(TaxFilingPgRepository.inMemoryDb.values()).filter(r => r.tenantId === tenantId);

    if (options?.status) {
      items = items.filter(r => r.status === options.status);
    }
    if (options?.period) {
      items = items.filter(r => r.period === options.period);
    }

    const total = items.length;
    items = items.slice(offset, offset + limit);

    return { items, total };
  }

  async update(taxFiling: TaxFiling, tenantId: string): Promise<TaxFiling> {
    const existing = await this.findById(taxFiling.id, tenantId);
    if (!existing) {
      throw new TaxFilingDomainError(`TaxFiling with id '${taxFiling.id}' not found`);
    }

    if (existing.version !== taxFiling.version) {
      throw new TaxFilingDomainError(
        `Optimistic concurrency conflict for TaxFiling '${taxFiling.id}': expected v${taxFiling.version}, found v${existing.version}`
      );
    }

    const updatedEntity = new TaxFiling({
      id: taxFiling.id,
      tenantId: taxFiling.tenantId,
      period: taxFiling.period,
      taxType: taxFiling.taxType,
      taxableAmountCents: taxFiling.taxableAmountCents,
      taxAmountCents: taxFiling.taxAmountCents,
      status: taxFiling.status,
      acknowledgementNumber: taxFiling.acknowledgementNumber,
      filingDate: taxFiling.filingDate,
      idempotencyKey: taxFiling.idempotencyKey,
      version: existing.version + 1,
      createdAt: taxFiling.createdAt,
      updatedAt: new Date(),
    });

    if (this.dbPool) {
      const client = await this.dbPool.connect();
      try {
        await client.query("SELECT set_config('app.current_tenant_id', $1, true)", [tenantId]);
        const query = `
          UPDATE finance_tax_filings
          SET status = $1, version = version + 1, updated_at = CURRENT_TIMESTAMP
          WHERE id = $2 AND tenant_id = $3 AND version = $4
          RETURNING *;
        `;
        const res = await client.query(query, [taxFiling.status, taxFiling.id, tenantId, taxFiling.version]);
        if (res.rows.length === 0) {
          throw new TaxFilingDomainError(`Update failed: Optimistic locking version conflict or TaxFiling not found`);
        }
      } finally {
        client.release();
      }
    }

    TaxFilingPgRepository.inMemoryDb.set(taxFiling.id, updatedEntity);
    return updatedEntity;
  }

  async delete(id: string, tenantId: string): Promise<boolean> {
    const existing = await this.findById(id, tenantId);
    if (!existing) return false;

    if (this.dbPool) {
      const client = await this.dbPool.connect();
      try {
        await client.query("SELECT set_config('app.current_tenant_id', $1, true)", [tenantId]);
        await client.query('DELETE FROM finance_tax_filings WHERE id = $1 AND tenant_id = $2', [id, tenantId]);
      } finally {
        client.release();
      }
    }

    TaxFilingPgRepository.inMemoryDb.delete(id);
    return true;
  }

  public static clearInMemoryStore(): void {
    TaxFilingPgRepository.inMemoryDb.clear();
  }

  private mapRowToEntity(row: any): TaxFiling {
    return new TaxFiling({
      id: row.id,
      tenantId: row.tenant_id,
      period: row.period,
      taxType: row.tax_type,
      taxableAmountCents: parseInt(row.taxable_amount_cents, 10),
      taxAmountCents: parseInt(row.tax_amount_cents, 10),
      status: row.status,
      acknowledgementNumber: row.acknowledgement_number,
      filingDate: row.filing_date ? new Date(row.filing_date) : undefined,
      idempotencyKey: row.idempotency_key,
      version: row.version,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    });
  }
}
