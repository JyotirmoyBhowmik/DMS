import { BasePostgresRepository, BaseRow, PostgresDatabaseClient, PgDriver } from '@dms/pkg-database';
import { DeliveryConfirmation, DeliveryStatus } from '../../../domain/entities/delivery-confirmation.js';
import { IDeliveryConfirmationRepository } from '../../../domain/repositories/delivery-confirmation.repository.js';
import { GeoPoint } from '../../../domain/value-objects/geo-point.js';
import { StructuredLogger } from '@dms/pkg-logger';
import { loadConfigSync } from '@dms/pkg-config';

const config = loadConfigSync();

class PgDeliveryConfirmationRepo extends BasePostgresRepository<DeliveryConfirmation> {
  async checkHealth() {
    return await this.db.checkHealth();
  }

  async query<T = unknown>(sql: string, params?: unknown[], tenantId?: string) {
    return await this.db.query<T>(sql, params, tenantId);
  }

  override tableName(): string {
    return 'delivery_confirmations';
  }

  public override mapToEntity(row: BaseRow): DeliveryConfirmation {
    return DeliveryConfirmation.reconstitute({
      id: row.id as string,
      tenantId: row.tenant_id as string,
      orderId: row.order_id as string,
      deliveredAt: new Date(row.delivered_at as any),
      receivedBy: row.received_by as string,
      signaturePhotoUrl: row.signature_photo_url as string || undefined,
      gpsLocation: GeoPoint.create(Number(row.gps_lat), Number(row.gps_lon)),
      status: row.status as DeliveryStatus,
      rejectionReason: row.rejection_reason as string || undefined,
      version: row.version as number || 1,
    });
  }

  protected mapToRow(entity: DeliveryConfirmation): BaseRow {
    return {
      id: entity.id,
      tenant_id: entity.tenantId,
      order_id: entity.orderId,
      delivered_at: entity.deliveredAt,
      received_by: entity.receivedBy,
      signature_photo_url: entity.signaturePhotoUrl || null,
      gps_lat: entity.gpsLocation.latitude,
      gps_lon: entity.gpsLocation.longitude,
      status: entity.status,
      rejection_reason: entity.rejectionReason || null,
      version: entity.version,
      created_at: new Date(),
      updated_at: new Date(),
    };
  }
}

export class DeliveryConfirmationPgRepository implements IDeliveryConfirmationRepository {
  private logger = new StructuredLogger('DeliveryConfirmationPgRepository');
  public static inMemoryDb: Map<string, DeliveryConfirmation> = new Map();
  private pgRepo: PgDeliveryConfirmationRepo;
  private hasDb = false;

  constructor(db?: PostgresDatabaseClient) {
    const activeDb = db ?? new PostgresDatabaseClient(config.db, new PgDriver());
    this.pgRepo = new PgDeliveryConfirmationRepo(activeDb);
    this.checkConnection().then(alive => {
      this.hasDb = alive;
    });
  }

  public static clearStore(): void {
    DeliveryConfirmationPgRepository.inMemoryDb.clear();
  }

  private async checkConnection(): Promise<boolean> {
    try {
      const res = await this.pgRepo.checkHealth();
      return res.status === 'HEALTHY';
    } catch {
      return false;
    }
  }

  async save(confirmation: DeliveryConfirmation): Promise<void> {
    if (this.hasDb) {
      try {
        this.logger.info('Saving DeliveryConfirmation to Postgres', { id: confirmation.id, tenantId: confirmation.tenantId });
        await this.pgRepo.save(confirmation, confirmation.tenantId);
        return;
      } catch (err: any) {
        this.logger.warn('Failed to save to Postgres, falling back to memory', { error: err.message });
      }
    }
    DeliveryConfirmationPgRepository.inMemoryDb.set(confirmation.id, confirmation);
  }

  async findById(id: string, tenantId: string): Promise<DeliveryConfirmation | null> {
    if (this.hasDb) {
      try {
        this.logger.info('Finding DeliveryConfirmation by ID from Postgres', { id, tenantId });
        return await this.pgRepo.findById(id, tenantId);
      } catch (err: any) {
        this.logger.warn('Failed to find in Postgres, falling back to memory', { error: err.message });
      }
    }
    const match = DeliveryConfirmationPgRepository.inMemoryDb.get(id);
    if (match && match.tenantId === tenantId) {
      return match;
    }
    return null;
  }

  async findByOrder(orderId: string, tenantId: string): Promise<DeliveryConfirmation | null> {
    if (this.hasDb) {
      try {
        this.logger.info('Finding DeliveryConfirmation by Order ID from Postgres', { orderId, tenantId });
        const sql = `SELECT * FROM "delivery_confirmations" WHERE "order_id" = $1 AND "tenant_id" = $2`;
        const res = await this.pgRepo.query<BaseRow>(sql, [orderId, tenantId], tenantId);
        if (res.rows.length === 0) return null;
        return this.pgRepo.mapToEntity(res.rows[0]);
      } catch (err: any) {
        this.logger.warn('Failed to find by order in Postgres, falling back to memory', { error: err.message });
      }
    }
    for (const item of DeliveryConfirmationPgRepository.inMemoryDb.values()) {
      if (item.orderId === orderId && item.tenantId === tenantId) {
        return item;
      }
    }
    return null;
  }

  async findByTenant(tenantId: string, limit: number = 50, offset: number = 0): Promise<DeliveryConfirmation[]> {
    if (this.hasDb) {
      try {
        this.logger.info('Listing DeliveryConfirmations from Postgres', { tenantId });
        const res = await this.pgRepo.findAll(tenantId, { pageSize: limit });
        return res.data;
      } catch (err: any) {
        this.logger.warn('Failed to findByTenant in Postgres, falling back to memory', { error: err.message });
      }
    }
    return Array.from(DeliveryConfirmationPgRepository.inMemoryDb.values())
      .filter(c => c.tenantId === tenantId)
      .slice(offset, offset + limit);
  }

  async delete(id: string, tenantId: string): Promise<void> {
    if (this.hasDb) {
      try {
        this.logger.info('Deleting DeliveryConfirmation from Postgres', { id, tenantId });
        await this.pgRepo.delete(id, tenantId);
        return;
      } catch (err: any) {
        this.logger.warn('Failed to delete in Postgres, falling back to memory', { error: err.message });
      }
    }
    const match = DeliveryConfirmationPgRepository.inMemoryDb.get(id);
    if (match && match.tenantId === tenantId) {
      DeliveryConfirmationPgRepository.inMemoryDb.delete(id);
    }
  }
}
