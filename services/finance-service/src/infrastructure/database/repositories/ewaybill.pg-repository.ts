import { EWayBillRepository, ListEWayBillsOptions } from '../../../domain/repositories/ewaybill.repository.js';
import { EWayBill, EWayBillDomainError } from '../../../domain/entities/ewaybill.entity.js';

export class EWayBillPgRepository implements EWayBillRepository {
  private static inMemoryDb = new Map<string, EWayBill>();

  constructor(private readonly dbPool?: any) {}

  async save(ewaybill: EWayBill, tenantId: string): Promise<EWayBill> {
    if (ewaybill.tenantId !== tenantId) {
      throw new EWayBillDomainError(`Tenant mismatch: eWayBill tenant '${ewaybill.tenantId}' does not match context '${tenantId}'`);
    }

    if (this.dbPool) {
      const client = await this.dbPool.connect();
      try {
        await client.query("SELECT set_config('app.current_tenant_id', $1, true)", [tenantId]);
        const query = `
          INSERT INTO finance_ewaybills (
            id, tenant_id, invoice_id, eway_bill_number, valid_until, vehicle_number, transporter_id,
            distance_km, status, idempotency_key, version, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
          RETURNING *;
        `;
        const values = [
          ewaybill.id, ewaybill.tenantId, ewaybill.invoiceId, ewaybill.ewayBillNumber, ewaybill.validUntil || null,
          ewaybill.vehicleNumber || null, ewaybill.transporterId || null, ewaybill.distanceKm,
          ewaybill.status, ewaybill.idempotencyKey || null, ewaybill.version, ewaybill.createdAt, ewaybill.updatedAt
        ];
        await client.query(query, values);
      } finally {
        client.release();
      }
    }

    EWayBillPgRepository.inMemoryDb.set(ewaybill.id, ewaybill);
    return ewaybill;
  }

  async findById(id: string, tenantId: string): Promise<EWayBill | null> {
    if (this.dbPool) {
      const client = await this.dbPool.connect();
      try {
        await client.query("SELECT set_config('app.current_tenant_id', $1, true)", [tenantId]);
        const res = await client.query(
          'SELECT * FROM finance_ewaybills WHERE id = $1 AND tenant_id = $2',
          [id, tenantId]
        );
        if (res.rows.length === 0) return null;
        return this.mapRowToEntity(res.rows[0]);
      } finally {
        client.release();
      }
    }

    const item = EWayBillPgRepository.inMemoryDb.get(id);
    if (!item || item.tenantId !== tenantId) return null;
    return item;
  }

  async findByEWayBillNumber(ewayBillNumber: string, tenantId: string): Promise<EWayBill | null> {
    if (this.dbPool) {
      const client = await this.dbPool.connect();
      try {
        await client.query("SELECT set_config('app.current_tenant_id', $1, true)", [tenantId]);
        const res = await client.query(
          'SELECT * FROM finance_ewaybills WHERE eway_bill_number = $1 AND tenant_id = $2',
          [ewayBillNumber, tenantId]
        );
        if (res.rows.length === 0) return null;
        return this.mapRowToEntity(res.rows[0]);
      } finally {
        client.release();
      }
    }

    for (const ewaybill of EWayBillPgRepository.inMemoryDb.values()) {
      if (ewaybill.tenantId === tenantId && ewaybill.ewayBillNumber === ewayBillNumber) {
        return ewaybill;
      }
    }
    return null;
  }

  async list(tenantId: string, options?: ListEWayBillsOptions): Promise<{ items: EWayBill[]; total: number }> {
    const page = options?.page || 1;
    const limit = Math.min(options?.limit || 20, 100);
    const offset = (page - 1) * limit;

    if (this.dbPool) {
      const client = await this.dbPool.connect();
      try {
        await client.query("SELECT set_config('app.current_tenant_id', $1, true)", [tenantId]);
        let query = 'SELECT * FROM finance_ewaybills WHERE tenant_id = $1';
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
        const countRes = await client.query('SELECT COUNT(*) FROM finance_ewaybills WHERE tenant_id = $1', [tenantId]);
        
        return {
          items: res.rows.map((row: any) => this.mapRowToEntity(row)),
          total: parseInt(countRes.rows[0].count, 10),
        };
      } finally {
        client.release();
      }
    }

    let items = Array.from(EWayBillPgRepository.inMemoryDb.values()).filter(r => r.tenantId === tenantId);

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

  async update(ewaybill: EWayBill, tenantId: string): Promise<EWayBill> {
    const existing = await this.findById(ewaybill.id, tenantId);
    if (!existing) {
      throw new EWayBillDomainError(`EWayBill with id '${ewaybill.id}' not found`);
    }

    if (existing.version !== ewaybill.version) {
      throw new EWayBillDomainError(
        `Optimistic concurrency conflict for EWayBill '${ewaybill.id}': expected v${ewaybill.version}, found v${existing.version}`
      );
    }

    const updatedEntity = new EWayBill({
      id: ewaybill.id,
      tenantId: ewaybill.tenantId,
      invoiceId: ewaybill.invoiceId,
      ewayBillNumber: ewaybill.ewayBillNumber,
      validUntil: ewaybill.validUntil,
      vehicleNumber: ewaybill.vehicleNumber,
      transporterId: ewaybill.transporterId,
      distanceKm: ewaybill.distanceKm,
      status: ewaybill.status,
      idempotencyKey: ewaybill.idempotencyKey,
      version: existing.version + 1,
      createdAt: ewaybill.createdAt,
      updatedAt: new Date(),
    });

    if (this.dbPool) {
      const client = await this.dbPool.connect();
      try {
        await client.query("SELECT set_config('app.current_tenant_id', $1, true)", [tenantId]);
        const query = `
          UPDATE finance_ewaybills
          SET status = $1, version = version + 1, updated_at = CURRENT_TIMESTAMP
          WHERE id = $2 AND tenant_id = $3 AND version = $4
          RETURNING *;
        `;
        const res = await client.query(query, [ewaybill.status, ewaybill.id, tenantId, ewaybill.version]);
        if (res.rows.length === 0) {
          throw new EWayBillDomainError(`Update failed: Optimistic locking version conflict or EWayBill not found`);
        }
      } finally {
        client.release();
      }
    }

    EWayBillPgRepository.inMemoryDb.set(ewaybill.id, updatedEntity);
    return updatedEntity;
  }

  async delete(id: string, tenantId: string): Promise<boolean> {
    const existing = await this.findById(id, tenantId);
    if (!existing) return false;

    if (this.dbPool) {
      const client = await this.dbPool.connect();
      try {
        await client.query("SELECT set_config('app.current_tenant_id', $1, true)", [tenantId]);
        await client.query('DELETE FROM finance_ewaybills WHERE id = $1 AND tenant_id = $2', [id, tenantId]);
      } finally {
        client.release();
      }
    }

    EWayBillPgRepository.inMemoryDb.delete(id);
    return true;
  }

  public static clearInMemoryStore(): void {
    EWayBillPgRepository.inMemoryDb.clear();
  }

  private mapRowToEntity(row: any): EWayBill {
    return new EWayBill({
      id: row.id,
      tenantId: row.tenant_id,
      invoiceId: row.invoice_id,
      ewayBillNumber: row.eway_bill_number,
      validUntil: row.valid_until ? new Date(row.valid_until) : undefined,
      vehicleNumber: row.vehicle_number,
      transporterId: row.transporter_id,
      distanceKm: parseInt(row.distance_km, 10),
      status: row.status,
      idempotencyKey: row.idempotency_key,
      version: row.version,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    });
  }
}
