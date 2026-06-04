import { DeliveryConfirmation, DeliveryStatus } from '../../../domain/entities/delivery-confirmation';
import { IDeliveryConfirmationRepository } from '../../../domain/repositories/delivery-confirmation.repository';
import { PostgresDatabaseClient } from '@dms/pkg-database';
import { StructuredLogger } from '@dms/pkg-logger';
import { GeoPoint } from '../../../domain/value-objects/geo-point';

export class DeliveryConfirmationPgRepository implements IDeliveryConfirmationRepository {
  private logger = new StructuredLogger('DeliveryConfirmationPgRepository');

  constructor(private readonly db: PostgresDatabaseClient) {}

  async save(confirmation: DeliveryConfirmation): Promise<void> {
    this.logger.info('Saving DeliveryConfirmation', { id: confirmation.id, tenantId: confirmation.tenantId });

    const sql = `
      INSERT INTO delivery_confirmations (
        id, tenant_id, order_id, delivered_at, received_by, signature_photo_url, gps_lat, gps_lon, status, rejection_reason, version, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW()
      )
      ON CONFLICT (id) DO UPDATE SET
        delivered_at = EXCLUDED.delivered_at,
        received_by = EXCLUDED.received_by,
        signature_photo_url = EXCLUDED.signature_photo_url,
        gps_lat = EXCLUDED.gps_lat,
        gps_lon = EXCLUDED.gps_lon,
        status = EXCLUDED.status,
        rejection_reason = EXCLUDED.rejection_reason,
        version = EXCLUDED.version,
        updated_at = NOW()
    `;

    await this.db.query(sql, [
      confirmation.id,
      confirmation.tenantId,
      confirmation.orderId,
      confirmation.deliveredAt,
      confirmation.receivedBy,
      confirmation.signaturePhotoUrl || null,
      confirmation.gpsLocation.latitude,
      confirmation.gpsLocation.longitude,
      confirmation.status,
      confirmation.rejectionReason || null,
      confirmation.version,
    ], confirmation.tenantId);
  }

  async findById(id: string): Promise<DeliveryConfirmation | null> {
    const sql = `SELECT * FROM delivery_confirmations WHERE id = $1`;
    const result = await this.db.query<any>(sql, [id]);
    
    if (result.rows.length === 0) return null;
    return this.mapToEntity(result.rows[0]);
  }

  async findByOrder(orderId: string, tenantId: string): Promise<DeliveryConfirmation | null> {
    const sql = `SELECT * FROM delivery_confirmations WHERE order_id = $1 AND tenant_id = $2`;
    const result = await this.db.query<any>(sql, [orderId, tenantId], tenantId);
    
    if (result.rows.length === 0) return null;
    return this.mapToEntity(result.rows[0]);
  }

  async findByTenant(tenantId: string, limit: number = 50, offset: number = 0): Promise<DeliveryConfirmation[]> {
    const sql = `SELECT * FROM delivery_confirmations WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`;
    const result = await this.db.query<any>(sql, [tenantId, limit, offset], tenantId);
    
    return result.rows.map(row => this.mapToEntity(row));
  }

  private mapToEntity(row: any): DeliveryConfirmation {
    return DeliveryConfirmation.reconstitute({
      id: row.id,
      tenantId: row.tenant_id,
      orderId: row.order_id,
      deliveredAt: new Date(row.delivered_at),
      receivedBy: row.received_by,
      signaturePhotoUrl: row.signature_photo_url || undefined,
      gpsLocation: GeoPoint.create(Number(row.gps_lat), Number(row.gps_lon)),
      status: row.status as DeliveryStatus,
      rejectionReason: row.rejection_reason || undefined,
      version: row.version,
    });
  }
}
