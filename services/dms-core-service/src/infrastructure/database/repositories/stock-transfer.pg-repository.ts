/**
 * Postgres Repository for StockTransfer.
 */
import { StockTransfer, StockTransferStatus, StockTransferItem } from '../../../domain/entities/stock-transfer.js';
import { StockTransferRepository } from '../../../domain/repositories/stock-transfer.repository.js';

export class StockTransferPgRepository extends StockTransferRepository {
  constructor(private pool: any) {
    super();
  }

  async save(transfer: StockTransfer): Promise<void> {
    const data = transfer.toJSON();
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      await client.query(
        `INSERT INTO stock_transfers
          (id, tenant_id, from_warehouse_id, to_warehouse_id, status, requested_by,
           approved_by, transfer_date, received_at, received_by, discrepancy_notes, version)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         ON CONFLICT (id) DO UPDATE SET
           status = $5, approved_by = $7, transfer_date = $8, received_at = $9,
           received_by = $10, discrepancy_notes = $11, version = $12`,
        [data.id, data.tenantId, data.fromWarehouseId, data.toWarehouseId, data.status,
         data.requestedBy, data.approvedBy ?? null, data.transferDate ?? null,
         data.receivedAt ?? null, data.receivedBy ?? null, data.discrepancyNotes ?? null, data.version]
      );

      // Upsert items
      await client.query(`DELETE FROM stock_transfer_items WHERE transfer_id = $1`, [data.id]);
      for (const item of data.items) {
        await client.query(
          `INSERT INTO stock_transfer_items
            (id, transfer_id, product_id, batch_number, quantity, expiry_date, received_quantity)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [item.id ?? crypto.randomUUID?.() ?? `sti-${Date.now()}`, data.id,
           item.productId, item.batchNumber, item.quantity, item.expiryDate,
           item.receivedQuantity ?? null]
        );
      }

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async findById(tenantId: string, id: string): Promise<StockTransfer | null> {
    const result = await this.pool.query(
      `SELECT * FROM stock_transfers WHERE tenant_id = $1 AND id = $2`,
      [tenantId, id]
    );
    if (!result.rows[0]) return null;
    const items = await this.findItemsByTransfer(id);
    return this.toDomain(result.rows[0], items);
  }

  async findByStatus(tenantId: string, status: StockTransferStatus): Promise<StockTransfer[]> {
    const result = await this.pool.query(
      `SELECT * FROM stock_transfers WHERE tenant_id = $1 AND status = $2 ORDER BY created_at DESC`,
      [tenantId, status]
    );
    return Promise.all(result.rows.map(async (r: any) => {
      const items = await this.findItemsByTransfer(r.id);
      return this.toDomain(r, items);
    }));
  }

  async findByWarehouse(tenantId: string, warehouseId: string, direction: 'from' | 'to'): Promise<StockTransfer[]> {
    const column = direction === 'from' ? 'from_warehouse_id' : 'to_warehouse_id';
    const result = await this.pool.query(
      `SELECT * FROM stock_transfers WHERE tenant_id = $1 AND ${column} = $2 ORDER BY created_at DESC`,
      [tenantId, warehouseId]
    );
    return Promise.all(result.rows.map(async (r: any) => {
      const items = await this.findItemsByTransfer(r.id);
      return this.toDomain(r, items);
    }));
  }

  async findAll(tenantId: string): Promise<StockTransfer[]> {
    const result = await this.pool.query(
      `SELECT * FROM stock_transfers WHERE tenant_id = $1 ORDER BY created_at DESC`,
      [tenantId]
    );
    return Promise.all(result.rows.map(async (r: any) => {
      const items = await this.findItemsByTransfer(r.id);
      return this.toDomain(r, items);
    }));
  }

  async delete(tenantId: string, id: string): Promise<void> {
    await this.pool.query(
      `DELETE FROM stock_transfers WHERE tenant_id = $1 AND id = $2`,
      [tenantId, id]
    );
  }

  private async findItemsByTransfer(transferId: string): Promise<StockTransferItem[]> {
    const result = await this.pool.query(
      `SELECT * FROM stock_transfer_items WHERE transfer_id = $1 ORDER BY created_at`,
      [transferId]
    );
    return result.rows.map((r: any) => ({
      id: r.id,
      productId: r.product_id,
      batchNumber: r.batch_number,
      quantity: r.quantity,
      expiryDate: r.expiry_date?.toISOString?.()?.split('T')[0] ?? r.expiry_date,
      receivedQuantity: r.received_quantity,
    }));
  }

  private toDomain(row: any, items: StockTransferItem[]): StockTransfer {
    return new StockTransfer({
      id: row.id,
      tenantId: row.tenant_id,
      fromWarehouseId: row.from_warehouse_id,
      toWarehouseId: row.to_warehouse_id,
      items,
      status: row.status,
      requestedBy: row.requested_by,
      approvedBy: row.approved_by,
      transferDate: row.transfer_date?.toISOString?.() ?? row.transfer_date,
      receivedAt: row.received_at?.toISOString?.() ?? row.received_at,
      receivedBy: row.received_by,
      discrepancyNotes: row.discrepancy_notes,
      version: row.version,
    });
  }
}
