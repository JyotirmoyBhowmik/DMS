/**
 * Batch Repository Interface (Port).
 */
import { Batch, BatchStatus } from '../entities/batch.js';

export abstract class BatchRepository {
  abstract save(batch: Batch): Promise<void>;
  abstract findById(tenantId: string, id: string): Promise<Batch | null>;
  abstract findByProduct(tenantId: string, productId: string): Promise<Batch[]>;
  abstract findByProductFEFO(tenantId: string, productId: string): Promise<Batch[]>;
  abstract findByStatus(tenantId: string, status: BatchStatus): Promise<Batch[]>;
  abstract findExpiringWithinDays(tenantId: string, days: number): Promise<Batch[]>;
  abstract findByBatchNumber(tenantId: string, productId: string, batchNumber: string): Promise<Batch | null>;
  abstract findAll(tenantId: string): Promise<Batch[]>;
  abstract delete(tenantId: string, id: string): Promise<void>;
}
