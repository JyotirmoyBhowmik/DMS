import { CompetitorCapture } from '../../../domain/entities/competitor-capture';
import { ICompetitorCaptureRepository } from '../../../domain/repositories/competitor-capture.repository';
import { PostgresDatabaseClient } from '@dms/pkg-database';
import { StructuredLogger } from '@dms/pkg-logger';
import { Money } from '../../../domain/value-objects/money';

export class CompetitorCapturePgRepository implements ICompetitorCaptureRepository {
  private logger = new StructuredLogger('CompetitorCapturePgRepository');

  constructor(private readonly db: PostgresDatabaseClient) {}

  async save(capture: CompetitorCapture): Promise<void> {
    this.logger.info('Saving CompetitorCapture', { id: capture.id, tenantId: capture.tenantId });

    const sql = `
      INSERT INTO competitor_captures (
        id, tenant_id, outlet_id, brand, sku_id, observed_price, observed_price_currency, promotion_details, photo_url, version, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW()
      )
      ON CONFLICT (id) DO UPDATE SET
        brand = EXCLUDED.brand,
        sku_id = EXCLUDED.sku_id,
        observed_price = EXCLUDED.observed_price,
        observed_price_currency = EXCLUDED.observed_price_currency,
        promotion_details = EXCLUDED.promotion_details,
        photo_url = EXCLUDED.photo_url,
        version = EXCLUDED.version,
        updated_at = NOW()
    `;

    await this.db.query(sql, [
      capture.id,
      capture.tenantId,
      capture.outletId,
      capture.brand,
      capture.skuId,
      capture.observedPrice.amount,
      capture.observedPrice.currency,
      capture.promotionDetails || null,
      capture.photoUrl || null,
      capture.version,
    ], capture.tenantId);
  }

  async findById(id: string): Promise<CompetitorCapture | null> {
    const sql = `SELECT * FROM competitor_captures WHERE id = $1`;
    const result = await this.db.query<any>(sql, [id]);
    
    if (result.rows.length === 0) return null;
    return this.mapToEntity(result.rows[0]);
  }

  async findByOutlet(outletId: string, tenantId: string): Promise<CompetitorCapture[]> {
    const sql = `SELECT * FROM competitor_captures WHERE outlet_id = $1 AND tenant_id = $2 ORDER BY created_at DESC`;
    const result = await this.db.query<any>(sql, [outletId, tenantId], tenantId);
    
    return result.rows.map(row => this.mapToEntity(row));
  }

  async findByTenant(tenantId: string, limit: number = 50, offset: number = 0): Promise<CompetitorCapture[]> {
    const sql = `SELECT * FROM competitor_captures WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`;
    const result = await this.db.query<any>(sql, [tenantId, limit, offset], tenantId);
    
    return result.rows.map(row => this.mapToEntity(row));
  }

  private mapToEntity(row: any): CompetitorCapture {
    return CompetitorCapture.reconstitute({
      id: row.id,
      tenantId: row.tenant_id,
      outletId: row.outlet_id,
      brand: row.brand,
      skuId: row.sku_id,
      observedPrice: Money.of(Number(row.observed_price), row.observed_price_currency),
      promotionDetails: row.promotion_details || undefined,
      photoUrl: row.photo_url || undefined,
      version: row.version,
    });
  }
}
