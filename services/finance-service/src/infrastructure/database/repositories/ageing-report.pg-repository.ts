import { AgeingReportRepository, ListAgeingReportsOptions } from '../../../domain/repositories/ageing-report.repository.js';
import { AgeingReport, AgeingReportDomainError } from '../../../domain/entities/ageing-report.entity.js';

export class AgeingReportPgRepository implements AgeingReportRepository {
  private static inMemoryDb = new Map<string, AgeingReport>();

  constructor(private readonly dbPool?: any) {}

  async save(report: AgeingReport, tenantId: string): Promise<AgeingReport> {
    if (report.tenantId !== tenantId) {
      throw new AgeingReportDomainError(`Tenant mismatch: report tenant '${report.tenantId}' does not match context '${tenantId}'`);
    }

    if (this.dbPool) {
      const client = await this.dbPool.connect();
      try {
        await client.query("SELECT set_config('app.current_tenant_id', $1, true)", [tenantId]);
        const query = `
          INSERT INTO finance_ageing_reports (
            id, tenant_id, distributor_id, as_of_date,
            current_bucket_cents, bucket_1_30_cents, bucket_31_60_cents, bucket_61_90_cents, bucket_90_plus_cents,
            total_outstanding_cents, status, idempotency_key, version, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
          RETURNING *;
        `;
        const values = [
          report.id, report.tenantId, report.distributorId, report.asOfDate.toISOString().substring(0, 10),
          report.currentBucketCents, report.bucket1To30Cents, report.bucket31To60Cents, report.bucket61To90Cents, report.bucket90PlusCents,
          report.totalOutstandingCents, report.status, report.idempotencyKey || null, report.version, report.createdAt, report.updatedAt
        ];
        await client.query(query, values);
      } finally {
        client.release();
      }
    }

    AgeingReportPgRepository.inMemoryDb.set(report.id, report);
    return report;
  }

  async findById(id: string, tenantId: string): Promise<AgeingReport | null> {
    if (this.dbPool) {
      const client = await this.dbPool.connect();
      try {
        await client.query("SELECT set_config('app.current_tenant_id', $1, true)", [tenantId]);
        const res = await client.query(
          'SELECT * FROM finance_ageing_reports WHERE id = $1 AND tenant_id = $2',
          [id, tenantId]
        );
        if (res.rows.length === 0) return null;
        return this.mapRowToEntity(res.rows[0]);
      } finally {
        client.release();
      }
    }

    const item = AgeingReportPgRepository.inMemoryDb.get(id);
    if (!item || item.tenantId !== tenantId) return null;
    return item;
  }

  async findByDistributorAndDate(distributorId: string, asOfDate: Date, tenantId: string): Promise<AgeingReport | null> {
    const targetDateStr = asOfDate.toISOString().substring(0, 10);

    if (this.dbPool) {
      const client = await this.dbPool.connect();
      try {
        await client.query("SELECT set_config('app.current_tenant_id', $1, true)", [tenantId]);
        const res = await client.query(
          'SELECT * FROM finance_ageing_reports WHERE distributor_id = $1 AND as_of_date = $2 AND tenant_id = $3',
          [distributorId, targetDateStr, tenantId]
        );
        if (res.rows.length === 0) return null;
        return this.mapRowToEntity(res.rows[0]);
      } finally {
        client.release();
      }
    }

    for (const report of AgeingReportPgRepository.inMemoryDb.values()) {
      if (
        report.tenantId === tenantId &&
        report.distributorId === distributorId &&
        report.asOfDate.toISOString().substring(0, 10) === targetDateStr
      ) {
        return report;
      }
    }
    return null;
  }

  async list(tenantId: string, options?: ListAgeingReportsOptions): Promise<{ items: AgeingReport[]; total: number }> {
    const page = options?.page || 1;
    const limit = Math.min(options?.limit || 20, 100);
    const offset = (page - 1) * limit;

    if (this.dbPool) {
      const client = await this.dbPool.connect();
      try {
        await client.query("SELECT set_config('app.current_tenant_id', $1, true)", [tenantId]);
        let query = 'SELECT * FROM finance_ageing_reports WHERE tenant_id = $1';
        const params: any[] = [tenantId];

        if (options?.status) {
          params.push(options.status);
          query += ` AND status = $${params.length}`;
        }
        if (options?.distributorId) {
          params.push(options.distributorId);
          query += ` AND distributor_id = $${params.length}`;
        }

        query += ' ORDER BY created_at DESC LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2);
        params.push(limit, offset);

        const res = await client.query(query, params);
        const countRes = await client.query('SELECT COUNT(*) FROM finance_ageing_reports WHERE tenant_id = $1', [tenantId]);
        
        return {
          items: res.rows.map((row: any) => this.mapRowToEntity(row)),
          total: parseInt(countRes.rows[0].count, 10),
        };
      } finally {
        client.release();
      }
    }

    let items = Array.from(AgeingReportPgRepository.inMemoryDb.values()).filter(r => r.tenantId === tenantId);

    if (options?.status) {
      items = items.filter(r => r.status === options.status);
    }
    if (options?.distributorId) {
      items = items.filter(r => r.distributorId === options.distributorId);
    }

    const total = items.length;
    items = items.slice(offset, offset + limit);

    return { items, total };
  }

  async update(report: AgeingReport, tenantId: string): Promise<AgeingReport> {
    const existing = await this.findById(report.id, tenantId);
    if (!existing) {
      throw new AgeingReportDomainError(`AgeingReport with id '${report.id}' not found`);
    }

    if (existing.version !== report.version) {
      throw new AgeingReportDomainError(
        `Optimistic concurrency conflict for AgeingReport '${report.id}': expected v${report.version}, found v${existing.version}`
      );
    }

    const updatedEntity = new AgeingReport({
      id: report.id,
      tenantId: report.tenantId,
      distributorId: report.distributorId,
      asOfDate: report.asOfDate,
      currentBucketCents: report.currentBucketCents,
      bucket1To30Cents: report.bucket1To30Cents,
      bucket31To60Cents: report.bucket31To60Cents,
      bucket61To90Cents: report.bucket61To90Cents,
      bucket90PlusCents: report.bucket90PlusCents,
      totalOutstandingCents: report.totalOutstandingCents,
      status: report.status,
      idempotencyKey: report.idempotencyKey,
      version: existing.version + 1,
      createdAt: report.createdAt,
      updatedAt: new Date(),
    });

    if (this.dbPool) {
      const client = await this.dbPool.connect();
      try {
        await client.query("SELECT set_config('app.current_tenant_id', $1, true)", [tenantId]);
        const query = `
          UPDATE finance_ageing_reports
          SET status = $1, version = version + 1, updated_at = CURRENT_TIMESTAMP
          WHERE id = $2 AND tenant_id = $3 AND version = $4
          RETURNING *;
        `;
        const res = await client.query(query, [report.status, report.id, tenantId, report.version]);
        if (res.rows.length === 0) {
          throw new AgeingReportDomainError(`Update failed: Optimistic locking version conflict or AgeingReport not found`);
        }
      } finally {
        client.release();
      }
    }

    AgeingReportPgRepository.inMemoryDb.set(report.id, updatedEntity);
    return updatedEntity;
  }

  async delete(id: string, tenantId: string): Promise<boolean> {
    const existing = await this.findById(id, tenantId);
    if (!existing) return false;

    if (this.dbPool) {
      const client = await this.dbPool.connect();
      try {
        await client.query("SELECT set_config('app.current_tenant_id', $1, true)", [tenantId]);
        await client.query('DELETE FROM finance_ageing_reports WHERE id = $1 AND tenant_id = $2', [id, tenantId]);
      } finally {
        client.release();
      }
    }

    AgeingReportPgRepository.inMemoryDb.delete(id);
    return true;
  }

  public static clearInMemoryStore(): void {
    AgeingReportPgRepository.inMemoryDb.clear();
  }

  private mapRowToEntity(row: any): AgeingReport {
    return new AgeingReport({
      id: row.id,
      tenantId: row.tenant_id,
      distributorId: row.distributor_id,
      asOfDate: new Date(row.as_of_date),
      currentBucketCents: parseInt(row.current_bucket_cents, 10),
      bucket1To30Cents: parseInt(row.bucket_1_30_cents, 10),
      bucket31To60Cents: parseInt(row.bucket_31_60_cents, 10),
      bucket61To90Cents: parseInt(row.bucket_61_90_cents, 10),
      bucket90PlusCents: parseInt(row.bucket_90_plus_cents, 10),
      totalOutstandingCents: parseInt(row.total_outstanding_cents, 10),
      status: row.status,
      idempotencyKey: row.idempotency_key,
      version: row.version,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    });
  }
}
