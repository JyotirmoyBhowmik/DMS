import { BaseRow, PostgresDatabaseClient } from '@dms/pkg-database';
import { MerchandisingAuditRepository } from '../../../domain/repositories/merchandising-audit.repository.js';
import { MerchandisingAudit, ShelfPhoto, BrandShelfShare, PricingAuditItem, MerchandisingAuditStatus } from '../../../domain/entities/merchandising-audit.js';
import { Money } from '../../../domain/value-objects/money.js';

export class MerchandisingAuditPgRepository extends MerchandisingAuditRepository {
  private static inMemoryDb = new Map<string, MerchandisingAudit>();

  constructor(private readonly db?: any) {
    super();
  }

  static clearStore(): void {
    MerchandisingAuditPgRepository.inMemoryDb.clear();
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

  public override async save(audit: MerchandisingAudit): Promise<MerchandisingAudit> {
    const isViable = await this.isDbViable();
    if (!isViable) {
      MerchandisingAuditPgRepository.inMemoryDb.set(audit.id, audit);
      return audit;
    }

    const row = this.mapToRow(audit);
    const existing = await this.findById(audit.id, audit.tenantId);
    if (existing) {
      if (existing.version !== audit.version) {
        throw new Error(`Optimistic locking conflict: version mismatch. DB version ${existing.version}, requested version ${audit.version}`);
      }
      
      const sql = `
        UPDATE merchandising_audits
        SET status = $1, shelf_photos = $2, planogram_compliance = $3, shelf_share_by_brand = $4,
            out_of_stock_skus = $5, pricing_audit = $6, display_score = $7, notes = $8,
            updated_at = $9, version = version + 1
        WHERE id = $10 AND tenant_id = $11
      `;
      const params = [
        row.status,
        JSON.stringify(row.shelf_photos),
        row.planogram_compliance,
        JSON.stringify(row.shelf_share_by_brand),
        row.out_of_stock_skus,
        JSON.stringify(row.pricing_audit),
        row.display_score,
        row.notes,
        row.updated_at,
        row.id,
        row.tenant_id,
      ];
      await this.db.query(sql, params, audit.tenantId);
    } else {
      const sql = `
        INSERT INTO merchandising_audits (
          id, tenant_id, agent_id, outlet_id, visit_id, audit_date, status,
          shelf_photos, planogram_compliance, shelf_share_by_brand, out_of_stock_skus,
          pricing_audit, display_score, notes, created_at, updated_at, version
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
      `;
      const params = [
        row.id,
        row.tenant_id,
        row.agent_id,
        row.outlet_id,
        row.visit_id,
        row.audit_date,
        row.status,
        JSON.stringify(row.shelf_photos),
        row.planogram_compliance,
        JSON.stringify(row.shelf_share_by_brand),
        row.out_of_stock_skus,
        JSON.stringify(row.pricing_audit),
        row.display_score,
        row.notes,
        row.created_at,
        row.updated_at,
        row.version,
      ];
      try {
        await this.db.query(sql, params, audit.tenantId);
      } catch (err: any) {
        if (err.message.includes('unique_constraint') || err.message.includes('uq_merchandising_audits_business_key')) {
          throw new Error(`An audit already exists for agent ${audit.agentId} at outlet ${audit.outletId} on date ${audit.auditDate}`);
        }
        throw err;
      }
    }
    return audit;
  }

  public override async findById(id: string, tenantId: string): Promise<MerchandisingAudit | null> {
    const isViable = await this.isDbViable();
    if (!isViable) {
      const found = MerchandisingAuditPgRepository.inMemoryDb.get(id);
      if (found && found.tenantId === tenantId) {
        return found;
      }
      return null;
    }

    const sql = `SELECT * FROM merchandising_audits WHERE id = $1 AND tenant_id = $2`;
    const res = await this.db.query(sql, [id, tenantId], tenantId);
    if (!res || res.length === 0) return null;
    return this.mapToEntity(res[0]);
  }

  public override async findAll(tenantId: string): Promise<MerchandisingAudit[]> {
    const isViable = await this.isDbViable();
    if (!isViable) {
      return Array.from(MerchandisingAuditPgRepository.inMemoryDb.values())
        .filter((a) => a.tenantId === tenantId);
    }

    const sql = `SELECT * FROM merchandising_audits WHERE tenant_id = $1 ORDER BY audit_date DESC`;
    const res = await this.db.query(sql, [tenantId], tenantId);
    return res.map((r: any) => this.mapToEntity(r));
  }

  public override async findByAgent(agentId: string, tenantId: string): Promise<MerchandisingAudit[]> {
    const isViable = await this.isDbViable();
    if (!isViable) {
      return Array.from(MerchandisingAuditPgRepository.inMemoryDb.values())
        .filter((a) => a.tenantId === tenantId && a.agentId === agentId);
    }

    const sql = `SELECT * FROM merchandising_audits WHERE agent_id = $1 AND tenant_id = $2 ORDER BY audit_date DESC`;
    const res = await this.db.query(sql, [agentId, tenantId], tenantId);
    return res.map((r: any) => this.mapToEntity(r));
  }

  public override async findByOutlet(outletId: string, tenantId: string): Promise<MerchandisingAudit[]> {
    const isViable = await this.isDbViable();
    if (!isViable) {
      return Array.from(MerchandisingAuditPgRepository.inMemoryDb.values())
        .filter((a) => a.tenantId === tenantId && a.outletId === outletId);
    }

    const sql = `SELECT * FROM merchandising_audits WHERE outlet_id = $1 AND tenant_id = $2 ORDER BY audit_date DESC`;
    const res = await this.db.query(sql, [outletId, tenantId], tenantId);
    return res.map((r: any) => this.mapToEntity(r));
  }

  public override async findByVisit(visitId: string, tenantId: string): Promise<MerchandisingAudit | null> {
    const isViable = await this.isDbViable();
    if (!isViable) {
      const found = Array.from(MerchandisingAuditPgRepository.inMemoryDb.values())
        .find((a) => a.tenantId === tenantId && a.visitId === visitId);
      return found || null;
    }

    const sql = `SELECT * FROM merchandising_audits WHERE visit_id = $1 AND tenant_id = $2`;
    const res = await this.db.query(sql, [visitId, tenantId], tenantId);
    if (!res || res.length === 0) return null;
    return this.mapToEntity(res[0]);
  }

  public override async delete(id: string, tenantId: string): Promise<void> {
    const isViable = await this.isDbViable();
    if (!isViable) {
      MerchandisingAuditPgRepository.inMemoryDb.delete(id);
      return;
    }

    const sql = `DELETE FROM merchandising_audits WHERE id = $1 AND tenant_id = $2`;
    await this.db.query(sql, [id, tenantId], tenantId);
  }

  private mapToEntity(row: BaseRow): MerchandisingAudit {
    const photos = typeof row.shelf_photos === 'string' ? JSON.parse(row.shelf_photos) : row.shelf_photos;
    const pricing = typeof row.pricing_audit === 'string' ? JSON.parse(row.pricing_audit) : row.pricing_audit;
    const share = typeof row.shelf_share_by_brand === 'string' ? JSON.parse(row.shelf_share_by_brand) : row.shelf_share_by_brand;

    return MerchandisingAudit.reconstitute({
      id: row.id as string,
      tenantId: row.tenant_id as string,
      agentId: row.agent_id as string,
      outletId: row.outlet_id as string,
      visitId: (row.visit_id as string) || null,
      auditDate: row.audit_date instanceof Date ? row.audit_date.toISOString().split('T')[0] : row.audit_date as string,
      shelfPhotos: (photos || []).map((p: any) => ({
        photoUrl: p.photoUrl,
        category: p.category,
        timestamp: new Date(p.timestamp),
      })),
      planogramCompliance: Number(row.planogram_compliance),
      shelfShareByBrand: (share || []).map((s: any) => ({
        brand: s.brand,
        percentage: Number(s.percentage),
      })),
      outOfStockSkus: (row.out_of_stock_skus || []) as string[],
      pricingAudit: (pricing || []).map((p: any) => ({
        skuId: p.skuId,
        listedPrice: Money.fromCents(p.listedPrice),
        actualPrice: Money.fromCents(p.actualPrice),
      })),
      displayScore: Number(row.display_score),
      notes: (row.notes as string) || null,
      status: row.status as MerchandisingAuditStatus,
      createdAt: new Date(row.created_at as any),
      updatedAt: new Date(row.updated_at as any),
      version: Number(row.version),
    });
  }

  private mapToRow(entity: MerchandisingAudit): BaseRow {
    return {
      id: entity.id,
      tenant_id: entity.tenantId,
      agent_id: entity.agentId,
      outlet_id: entity.outletId,
      visit_id: entity.visitId,
      audit_date: entity.auditDate,
      shelf_photos: entity.shelfPhotos.map((p) => ({
        photoUrl: p.photoUrl,
        category: p.category,
        timestamp: p.timestamp.toISOString(),
      })),
      planogram_compliance: entity.planogramCompliance,
      shelf_share_by_brand: entity.shelfShareByBrand.map((s) => ({ ...s })),
      outOfStockSkus: [...entity.outOfStockSkus],
      pricing_audit: entity.pricingAudit.map((p) => ({
        skuId: p.skuId,
        listedPrice: p.listedPrice.cents,
        actualPrice: p.actualPrice.cents,
      })),
      display_score: entity.displayScore,
      notes: entity.notes,
      status: entity.status,
      created_at: entity.createdAt,
      updated_at: entity.updatedAt,
      version: entity.version,
    };
  }
}
