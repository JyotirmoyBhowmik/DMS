/**
 * StockTransfer Repository Interface (Port).
 */
import { StockTransfer, StockTransferStatus } from '../entities/stock-transfer.js';

export abstract class StockTransferRepository {
  abstract save(transfer: StockTransfer): Promise<void>;
  abstract findById(tenantId: string, id: string): Promise<StockTransfer | null>;
  abstract findByStatus(tenantId: string, status: StockTransferStatus): Promise<StockTransfer[]>;
  abstract findByWarehouse(tenantId: string, warehouseId: string, direction: 'from' | 'to'): Promise<StockTransfer[]>;
  abstract findAll(tenantId: string): Promise<StockTransfer[]>;
  abstract delete(tenantId: string, id: string): Promise<void>;
}
