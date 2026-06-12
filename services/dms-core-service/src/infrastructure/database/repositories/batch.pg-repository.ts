/**
 * Postgres Repository for Batch.
 */
import { Batch, BatchStatus } from '../../../domain/entities/batch.js';
import { BatchRepository } from '../../../domain/repositories/batch.repository.js';
import { PostgresDatabaseClient, ConcurrencyError } from '@dms/pkg-database';

export class BatchPgRepository extends BatchRepository {
  constructor(private db: PostgresDatabaseClient) {
    super();
  }

  async save(batch: Batch): Promise<void> {
    const data = batch.toJSON();
    // 1. Try updating first with version check
    const updateResult = await this.db.query(
      `UPDATE batches
       SET quantity = $1, quarantine_quantity = $2, status = $3, mfg_lot_number = $4, version = $5, updated_at = now()
       WHERE id = $6 AND version = $7 AND tenant_id = $8`,
      [data.quantity, data.quarantineQuantity, data.status, data.mfgLotNumber ?? null, data.version, data.id, (data as any).originalVersion, data.tenantId],
      batch.tenantId
    );

    // 2. If no rows updated, it could be a version conflict or a new record
    if (updateResult.rowCount === 0) {
      // Check if record exists
      const exists = await this.db.query<any>(
        `SELECT version FROM batches WHERE id = $1 AND tenant_id = $2`,
        [data.id, data.tenantId],
        batch.tenantId
      );

      if (exists.rows.length > 0) {
        // Record exists, but version was different -> Concurrency conflict!
        throw new ConcurrencyError('Batch', data.id);
      } else {
        // Record does not exist -> Insert
        await this.db.query(
          `INSERT INTO batches
            (id, tenant_id, product_id, batch_number, manufacturing_date, expiry_date,
             quantity, quarantine_quantity, status, mfg_lot_number, version)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
          [data.id, data.tenantId, data.productId, data.batchNumber,
           data.manufacturingDate, data.expiryDate, data.quantity, data.quarantineQuantity,
           data.status, data.mfgLotNumber ?? null, data.version],
          batch.tenantId
        );
      }
    }
  }

  async findById(tenantId: string, id: string): Promise<Batch | null> {
    const result = await this.db.query<any>(
      `SELECT * FROM batches WHERE tenant_id = $1 AND id = $2`,
      [tenantId, id],
      tenantId
    );
    return result.rows[0] ? this.toDomain(result.rows[0]) : null;
  }

  async findByProduct(tenantId: string, productId: string): Promise<Batch[]> {
    const result = await this.db.query<any>(
      `SELECT * FROM batches WHERE tenant_id = $1 AND product_id = $2 ORDER BY expiry_date ASC`,
      [tenantId, productId],
      tenantId
    );
    return result.rows.map((r: any) => this.toDomain(r));
  }

  async findByProductFEFO(tenantId: string, productId: string): Promise<Batch[]> {
    const result = await this.db.query<any>(
      `SELECT * FROM batches WHERE tenant_id = $1 AND product_id = $2 AND status = 'ACTIVE' ORDER BY expiry_date ASC`,
      [tenantId, productId],
      tenantId
    );
    return result.rows.map((r: any) => this.toDomain(r));
  }

  async findByStatus(tenantId: string, status: BatchStatus): Promise<Batch[]> {
    const result = await this.db.query<any>(
      `SELECT * FROM batches WHERE tenant_id = $1 AND status = $2 ORDER BY expiry_date ASC`,
      [tenantId, status],
      tenantId
    );
    return result.rows.map((r: any) => this.toDomain(r));
  }

  async findExpiringWithinDays(tenantId: string, days: number): Promise<Batch[]> {
    const result = await this.db.query<any>(
      `SELECT * FROM batches
       WHERE tenant_id = $1 AND status = 'ACTIVE'
         AND expiry_date <= CURRENT_DATE + make_interval(days => $2)
         AND expiry_date > CURRENT_DATE
       ORDER BY expiry_date ASC`,
      [tenantId, days],
      tenantId
    );
    return result.rows.map((r: any) => this.toDomain(r));
  }

  async findByBatchNumber(tenantId: string, productId: string, batchNumber: string): Promise<Batch | null> {
    const result = await this.db.query<any>(
      `SELECT * FROM batches WHERE tenant_id = $1 AND product_id = $2 AND batch_number = $3`,
      [tenantId, productId, batchNumber],
      tenantId
    );
    return result.rows[0] ? this.toDomain(result.rows[0]) : null;
  }

  async findAll(tenantId: string): Promise<Batch[]> {
    const result = await this.db.query<any>(
      `SELECT * FROM batches WHERE tenant_id = $1 ORDER BY product_id, expiry_date ASC`,
      [tenantId],
      tenantId
    );
    return result.rows.map((r: any) => this.toDomain(r));
  }

  async delete(tenantId: string, id: string): Promise<void> {
    await this.db.query(
      `DELETE FROM batches WHERE tenant_id = $1 AND id = $2`,
      [tenantId, id],
      tenantId
    );
  }

  private toDomain(row: any): Batch {
    return new Batch({
      id: row.id,
      tenantId: row.tenant_id,
      productId: row.product_id,
      batchNumber: row.batch_number,
      manufacturingDate: row.manufacturing_date?.toISOString?.()?.split('T')[0] ?? row.manufacturing_date,
      expiryDate: row.expiry_date?.toISOString?.()?.split('T')[0] ?? row.expiry_date,
      quantity: row.quantity,
      quarantineQuantity: row.quarantine_quantity,
      status: row.status,
      mfgLotNumber: row.mfg_lot_number,
      version: row.version,
    });
  }
}
