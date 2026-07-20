import { BaseRow } from '@dms/pkg-database';
import { PhotoCaptureRepository } from '../../../domain/repositories/photo-capture.repository.js';
import { PhotoCapture, PhotoCaptureStatus } from '../../../domain/entities/photo-capture.js';

export class PhotoCapturePgRepository extends PhotoCaptureRepository {
  private static inMemoryDb = new Map<string, PhotoCapture>();

  constructor(private readonly db?: any) {
    super();
  }

  static clearStore(): void {
    PhotoCapturePgRepository.inMemoryDb.clear();
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

  public override async save(capture: PhotoCapture): Promise<PhotoCapture> {
    const isViable = await this.isDbViable();
    if (!isViable) {
      PhotoCapturePgRepository.inMemoryDb.set(capture.id, capture);
      return capture;
    }

    const row = this.mapToRow(capture);
    const existing = await this.findById(capture.id, capture.tenantId);

    if (existing) {
      if (existing.version !== capture.version) {
        throw new Error(`Optimistic locking conflict: version mismatch. DB version ${existing.version}, requested version ${capture.version}`);
      }

      const sql = `
        UPDATE photo_captures
        SET photo_url = $1, tags = $2, notes = $3, status = $4,
            updated_at = $5, version = version + 1
        WHERE id = $6 AND tenant_id = $7
      `;
      const params = [
        row.photo_url,
        row.tags,
        row.notes,
        row.status,
        row.updated_at,
        row.id,
        row.tenant_id,
      ];
      await this.db.query(sql, params, capture.tenantId);
    } else {
      const sql = `
        INSERT INTO photo_captures (
          id, tenant_id, agent_id, outlet_id, capture_date, photo_url,
          tags, notes, status, created_at, updated_at, version
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      `;
      const params = [
        row.id,
        row.tenant_id,
        row.agent_id,
        row.outlet_id,
        row.capture_date,
        row.photo_url,
        row.tags,
        row.notes,
        row.status,
        row.created_at,
        row.updated_at,
        row.version,
      ];
      try {
        await this.db.query(sql, params, capture.tenantId);
      } catch (err: any) {
        if (err.message.includes('unique_constraint') || err.message.includes('uq_photo_captures_business_key')) {
          throw new Error(`A photo capture already exists for url ${capture.photoUrl} at outlet ${capture.outletId}`);
        }
        throw err;
      }
    }

    return capture;
  }

  public override async findById(id: string, tenantId: string): Promise<PhotoCapture | null> {
    const isViable = await this.isDbViable();
    if (!isViable) {
      const found = PhotoCapturePgRepository.inMemoryDb.get(id);
      if (found && found.tenantId === tenantId) {
        return found;
      }
      return null;
    }

    const sql = `SELECT * FROM photo_captures WHERE id = $1 AND tenant_id = $2`;
    const res = await this.db.query(sql, [id, tenantId], tenantId);
    if (!res || res.length === 0) return null;
    return this.mapToEntity(res[0]);
  }

  public override async findByAgent(agentId: string, tenantId: string): Promise<PhotoCapture[]> {
    const isViable = await this.isDbViable();
    if (!isViable) {
      return Array.from(PhotoCapturePgRepository.inMemoryDb.values())
        .filter((c) => c.tenantId === tenantId && c.agentId === agentId);
    }

    const sql = `SELECT * FROM photo_captures WHERE agent_id = $1 AND tenant_id = $2 ORDER BY capture_date DESC`;
    const res = await this.db.query(sql, [agentId, tenantId], tenantId);
    return res.map((r: any) => this.mapToEntity(r));
  }

  public override async findByOutlet(outletId: string, tenantId: string): Promise<PhotoCapture[]> {
    const isViable = await this.isDbViable();
    if (!isViable) {
      return Array.from(PhotoCapturePgRepository.inMemoryDb.values())
        .filter((c) => c.tenantId === tenantId && c.outletId === outletId);
    }

    const sql = `SELECT * FROM photo_captures WHERE outlet_id = $1 AND tenant_id = $2 ORDER BY capture_date DESC`;
    const res = await this.db.query(sql, [outletId, tenantId], tenantId);
    return res.map((r: any) => this.mapToEntity(r));
  }

  public override async findAll(tenantId: string, limit: number = 50, offset: number = 0): Promise<PhotoCapture[]> {
    const isViable = await this.isDbViable();
    if (!isViable) {
      return Array.from(PhotoCapturePgRepository.inMemoryDb.values())
        .filter((c) => c.tenantId === tenantId)
        .slice(offset, offset + limit);
    }

    const sql = `SELECT * FROM photo_captures WHERE tenant_id = $1 ORDER BY capture_date DESC LIMIT $2 OFFSET $3`;
    const res = await this.db.query(sql, [tenantId, limit, offset], tenantId);
    return res.map((r: any) => this.mapToEntity(r));
  }

  public override async delete(id: string, tenantId: string): Promise<void> {
    const isViable = await this.isDbViable();
    if (!isViable) {
      PhotoCapturePgRepository.inMemoryDb.delete(id);
      return;
    }

    const sql = `DELETE FROM photo_captures WHERE id = $1 AND tenant_id = $2`;
    await this.db.query(sql, [id, tenantId], tenantId);
  }

  public override async count(tenantId: string): Promise<number> {
    const isViable = await this.isDbViable();
    if (!isViable) {
      return Array.from(PhotoCapturePgRepository.inMemoryDb.values())
        .filter((c) => c.tenantId === tenantId).length;
    }

    const sql = `SELECT COUNT(*) as count FROM photo_captures WHERE tenant_id = $1`;
    const res = await this.db.query(sql, [tenantId], tenantId);
    return Number(res[0]?.count ?? 0);
  }

  private mapToEntity(row: BaseRow): PhotoCapture {
    return PhotoCapture.reconstitute({
      id: row.id as string,
      tenantId: row.tenant_id as string,
      agentId: row.agent_id as string,
      outletId: row.outlet_id as string,
      captureDate: row.capture_date instanceof Date ? row.capture_date.toISOString().split('T')[0] : row.capture_date as string,
      photoUrl: row.photo_url as string,
      tags: (row.tags || []) as string[],
      notes: (row.notes as string) || null,
      status: row.status as PhotoCaptureStatus,
      createdAt: new Date(row.created_at as any),
      updatedAt: new Date(row.updated_at as any),
      version: Number(row.version),
    });
  }

  private mapToRow(entity: PhotoCapture): BaseRow {
    return {
      id: entity.id,
      tenant_id: entity.tenantId,
      agent_id: entity.agentId,
      outlet_id: entity.outletId,
      capture_date: entity.captureDate,
      photo_url: entity.photoUrl,
      tags: entity.tags,
      notes: entity.notes,
      status: entity.status,
      created_at: entity.createdAt,
      updated_at: entity.updatedAt,
      version: entity.version,
    };
  }
}
