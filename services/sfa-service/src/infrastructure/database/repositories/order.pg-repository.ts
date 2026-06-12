import { BasePostgresRepository, BaseRow } from '@dms/pkg-database';
import { OrderEntity } from '../../../domain/entities/order.entity.js';
import { IOrderRepository } from '../../../domain/repositories/order.repository.js';

export class OrderPgRepository extends BasePostgresRepository<OrderEntity> implements IOrderRepository {
  protected tableName(): string {
    return 'orders';
  }

  protected mapToEntity(row: BaseRow): OrderEntity {
    // Deserialize columns into OrderEntity structure
    let items: any[] = [];
    if (typeof row.lines === 'string') {
      try {
        items = JSON.parse(row.lines);
      } catch {
        items = [];
      }
    } else if (Array.isArray(row.lines)) {
      items = row.lines;
    }

    return new OrderEntity({
      id: row.id,
      tenantId: row.tenant_id,
      outletId: row.outlet_id as string,
      agentId: row.agent_id as string,
      distributorId: row.distributor_id as string,
      totalAmount: Number(row.net_amount) / 100, // stored as cents/paise
      notes: row.customer_note as string,
      status: (row.status as string).toLowerCase() as any,
      items: items.map(l => ({
        skuId: l.skuId || l.sku_id || l.sku,
        quantity: l.quantity || l.qty,
        price: (l.price || l.unit_price) / 100,
      })),
      idempotencyKey: row.idempotency_key as string,
      placedAt: row.placed_at as Date,
      version: row.version,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }

  protected mapToRow(entity: OrderEntity): BaseRow {
    // Map items list to DB JSON structure with cents/paise
    const lines = entity.items.map(item => ({
      sku: item.skuId,
      qty: item.quantity,
      unit_price: Math.round(item.price * 100),
      tax_rate: 18.0,
      line_total: Math.round(item.price * item.quantity * 1.18 * 100),
    }));

    const gross = entity.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const tax = gross * 0.18;

    return {
      id: entity.id,
      tenant_id: entity.tenantId,
      outlet_id: entity.outletId,
      agent_id: entity.agentId || '00000000-0000-0000-0000-000000000000',
      distributor_id: entity.distributorId || '00000000-0000-0000-0000-000000000000',
      status: (entity.status || 'placed').toUpperCase(),
      lines: JSON.stringify(lines) as any, // Stringify array to JSON string to prevent pg array formatting!
      scheme_ids: [],
      gross_amount: Math.round(gross * 100),
      discount_amount: 0,
      tax_amount: Math.round(tax * 100),
      net_amount: Math.round(entity.totalAmount * 100),
      currency: 'INR',
      customer_note: entity.notes || null,
      idempotency_key: entity.idempotencyKey || `idem-${entity.id}`,
      placed_at: entity.placedAt || new Date(),
      version: entity.version || 0,
      created_at: entity.createdAt || new Date(),
      updated_at: entity.updatedAt || new Date(),
    };
  }
}
