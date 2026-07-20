import { BaseRow } from '@dms/pkg-database';
import { CompetitorCaptureRepository } from '../../../domain/repositories/competitor-capture.repository.js';
import { CompetitorCapture, CompetitorCaptureStatus } from '../../../domain/entities/competitor-capture.js';
import { Money } from '../../../domain/value-objects/money.js';

export class CompetitorCapturePgRepository extends CompetitorCaptureRepository {
  private static inMemoryDb = new Map<string, CompetitorCapture>();

  constructor(private readonly db?: any) {
    super();
  }

  static clearStore(): void {
    CompetitorCapturePgRepository.inMemoryDb.clear();
  }

  private async isDbViable(): Promise<boolean> {
    if (!this.db) return false;
    try {
      await this.db.query('SELECT 1');
      return true;
    } catch {
      return false;
    }
  }

  public override async save(capture: CompetitorCapture): Promise<CompetitorCapture> {
    const isViable = await this.isDbViable();
    if (!isViable) {
      CompetitorCapturePgRepository.inMemoryDb.set(capture.id, capture);
      return capture;
    }

    const row = this.mapToRow(capture);
    const existing = await this.findById(capture.id, capture.tenantId);

    if (existing) {
      if (existing.version !== capture.version) {
        throw new Error(`Optimistic locking conflict: version mismatch. DB version ${existing.version}, requested version ${capture.version}`);
      }

      const sql = `
        UPDATE competitor_captures
        SET brand = $1, sku_id = $2, observed_price_cents = $3, observed_price_currency = $4,
            promotion_details = $5, photo_url = $6, notes = $7, status = $8,
            updated_at = $9, version = version + 1
        WHERE id = $10 AND tenant_id = $11
      `;
      const params = [
        row.brand,
        row.sku_id,
        row.observed_price_cents,
        row.observed_price_currency,
        row.promotion_details,
        row.photo_url,
        row.notes,
        row.status,
        row.updated_at,
        row.id,
        row.tenant_id,
      ];
      await this.db.query(sql, params, capture.tenantId);
    } else {
      const sql = `
        INSERT INTO competitor_captures (
          id, tenant_id, agent_id, outlet_id, capture_date, brand, sku_id,
          observed_price_cents, observed_price_currency, promotion_details,
          photo_url, notes, status, created_at, updated_at, version
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      `;
      const params = [
        row.id,
        row.tenant_id,
        row.agent_id,
        row.outlet_id,
        row.capture_date,
        row.brand,
        row.sku_id,
        row.observed_price_cents,
        row.observed_price_currency,
        row.promotion_details,
        row.photo_url,
        row.notes,
        row.status,
        row.created_at,
        row.updated_at,
        row.version,
      ];
      try {
        await this.db.query(sql, params, capture.tenantId);
      } catch (err: any) {
        if (err.message.includes('unique_constraint') || err.message.includes('uq_competitor_captures_business_key')) {
          throw new Error(`A competitor capture already exists for brand ${capture.brand} sku ${capture.skuId} at outlet ${capture.outletId} on date ${capture.captureDate}`);
        }
        throw err;
      }
    }

    return capture;
  }

  public override async findById(id: string, tenantId: string): Promise<CompetitorCapture | null> {
    const isViable = await this.isDbViable();
    if (!isViable) {
      const found = CompetitorCapturePgRepository.inMemoryDb.get(id);
      if (found && found.tenantId === tenantId) {
        return found;
      }
      return null;
    }

    const sql = `SELECT * FROM competitor_captures WHERE id = $1 AND tenant_id = $2`;
    const res = await this.db.query(sql, [id, tenantId], tenantId);
    if (!res || res.length === 0) return null;
    return this.mapToEntity(res[0]);
  }

  public override async findByAgent(agentId: string, tenantId: string): Promise<CompetitorCapture[]> {
    const isViable = await this.isDbViable();
    if (!isViable) {
      return Array.from(CompetitorCapturePgRepository.inMemoryDb.values())
        .filter((c) => c.tenantId === tenantId && c.agentId === agentId);
    }

    const sql = `SELECT * FROM competitor_captures WHERE agent_id = $1 AND tenant_id = $2 ORDER BY capture_date DESC`;
    const res = await this.db.query(sql, [agentId, tenantId], tenantId);
    return res.map((r: any) => this.mapToEntity(r));
  }

  public override async findByOutlet(outletId: string, tenantId: string): Promise<CompetitorCapture[]> {
    const isViable = await this.isDbViable();
    if (!isViable) {
      return Array.from(CompetitorCapturePgRepository.inMemoryDb.values())
        .filter((c) => c.tenantId === tenantId && c.outletId === outletId);
    }

    const sql = `SELECT * FROM competitor_captures WHERE outlet_id = $1 AND tenant_id = $2 ORDER BY capture_date DESC`;
    const res = await this.db.query(sql, [outletId, tenantId], tenantId);
    return res.map((r: any) => this.mapToEntity(r));
  }

  public override async findAll(tenantId: string, limit: number = 50, offset: number = 0): Promise<CompetitorCapture[]> {
    const isViable = await this.isDbViable();
    if (!isViable) {
      return Array.from(CompetitorCapturePgRepository.inMemoryDb.values())
        .filter((c) => c.tenantId === tenantId)
        .slice(offset, offset + limit);
    }

    const sql = `SELECT * FROM competitor_captures WHERE tenant_id = $1 ORDER BY capture_date DESC LIMIT $2 OFFSET $3`;
    const res = await this.db.query(sql, [tenantId, limit, offset], tenantId);
    return res.map((r: any) => this.mapToEntity(r));
  }

  public override async delete(id: string, tenantId: string): Promise<void> {
    const isViable = await this.isDbViable();
    if (!isViable) {
      CompetitorCapturePgRepository.inMemoryDb.delete(id);
      return;
    }

    const sql = `DELETE FROM competitor_captures WHERE id = $1 AND tenant_id = $2`;
    await this.db.query(sql, [id, tenantId], tenantId);
  }

  public override async count(tenantId: string): Promise<number> {
    const isViable = await this.isDbViable();
    if (!isViable) {
      return Array.from(CompetitorCapturePgRepository.inMemoryDb.values())
        .filter((c) => c.tenantId === tenantId).length;
    }

    const sql = `SELECT COUNT(*) as count FROM competitor_captures WHERE tenant_id = $1`;
    const res = await this.db.query(sql, [tenantId], tenantId);
    return Number(res[0]?.count ?? 0);
  }

  private mapToEntity(row: BaseRow): CompetitorCapture {
    return CompetitorCapture.reconstitute({
      id: row.id as string,
      tenantId: row.tenant_id as string,
      agentId: row.agent_id as string,
      outletId: row.outlet_id as string,
      captureDate: row.capture_date instanceof Date ? row.capture_date.toISOString().split('T')[0] : row.capture_date as string,
      brand: row.brand as string,
      skuId: row.sku_id as string,
      observedPrice: Money.fromCents(Number(row.observed_price_cents)),
      promotionDetails: (row.promotion_details as string) || null,
      photoUrl: (row.photo_url as string) || null,
      notes: (row.notes as string) || null,
      status: row.status as CompetitorCaptureStatus,
      createdAt: new Date(row.created_at as any),
      updatedAt: new Date(row.updated_at as any),
      version: Number(row.version),
    });
  }

  private mapToRow(entity: CompetitorCapture): BaseRow {
    return {
      id: entity.id,
      tenant_id: entity.tenantId,
      agent_id: entity.agentId,
      outlet_id: entity.outletId,
      capture_date: entity.captureDate,
      brand: entity.brand,
      sku_id: entity.skuId,
      observed_price_cents: entity.observedPrice.cents,
      observed_price_currency: entity.observedPrice.currency,
      promotion_details: entity.promotionDetails,
      photo_url: entity.photoUrl,
      notes: entity.notes,
      status: entity.status,
      created_at: entity.createdAt,
      updated_at: entity.updatedAt,
      version: entity.version,
    };
  }
}
