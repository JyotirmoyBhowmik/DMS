export interface StockBatch {
  batchNumber: string;
  quantity: number;
  expiryDate: string; // ISO-8601 string
}

export interface StockReservation {
  reservationId: string;
  batchNumber: string;
  quantity: number;
  expiresAt: number; // epoch ms
}

export class InventoryAggregate {
  public readonly id: string;
  public readonly tenantId: string;
  public readonly productId: string;
  public readonly warehouseId: string;
  
  private batches: Map<string, StockBatch> = new Map();
  private reservations: Map<string, StockReservation> = new Map();

  constructor(id: string, tenantId: string, productId: string, warehouseId: string) {
    this.id = id;
    this.tenantId = tenantId;
    this.productId = productId;
    this.warehouseId = warehouseId;
  }

  get totalStock(): number {
    let total = 0;
    for (const batch of this.batches.values()) {
      // Exclude expired batches from available stock
      if (new Date(batch.expiryDate).getTime() > Date.now()) {
        total += batch.quantity;
      }
    }
    return total;
  }

  getBatchStock(batchNumber: string): number {
    const batch = this.batches.get(batchNumber);
    if (!batch) return 0;
    if (new Date(batch.expiryDate).getTime() <= Date.now()) return 0; // expired
    return batch.quantity;
  }

  adjustStock(batchNumber: string, quantity: number, expiryDate: string): void {
    if (quantity === 0) return;
    
    const existing = this.batches.get(batchNumber);
    if (existing) {
      existing.quantity += quantity;
      if (existing.quantity < 0) {
        throw new Error(`Adjustment would result in negative stock for batch ${batchNumber}`);
      }
    } else {
      if (quantity < 0) {
        throw new Error(`Cannot initialize batch ${batchNumber} with negative stock`);
      }
      this.batches.set(batchNumber, {
        batchNumber,
        quantity,
        expiryDate,
      });
    }
  }

  reserveStock(reservationId: string, batchNumber: string, quantity: number, ttlMs = 600000): void {
    const batch = this.batches.get(batchNumber);
    if (!batch) {
      throw new Error(`Batch ${batchNumber} not found`);
    }

    if (new Date(batch.expiryDate).getTime() <= Date.now()) {
      throw new Error(`Batch ${batchNumber} has expired and cannot be reserved`);
    }

    if (batch.quantity < quantity) {
      throw new Error(`Insufficient stock in batch ${batchNumber}. Available: ${batch.quantity}, Requested: ${quantity}`);
    }

    // Deduct from batch
    batch.quantity -= quantity;

    // Create reservation
    this.reservations.set(reservationId, {
      reservationId,
      batchNumber,
      quantity,
      expiresAt: Date.now() + ttlMs,
    });
  }

  releaseReservation(reservationId: string): void {
    const res = this.reservations.get(reservationId);
    if (!res) {
      throw new Error(`Reservation ${reservationId} not found`);
    }

    const batch = this.batches.get(res.batchNumber);
    if (batch) {
      // Put stock back (even if expired, we return it to the batch pool)
      batch.quantity += res.quantity;
    }

    this.reservations.delete(reservationId);
  }

  confirmReservation(reservationId: string): void {
    const res = this.reservations.get(reservationId);
    if (!res) {
      throw new Error(`Reservation ${reservationId} not found`);
    }
    
    if (res.expiresAt < Date.now()) {
      // Expired reservation is auto-released and cannot be confirmed
      this.releaseReservation(reservationId);
      throw new Error(`Reservation ${reservationId} has expired`);
    }

    // Successfully consumed reservation stock
    this.reservations.delete(reservationId);
  }

  clearExpiredReservations(): void {
    const now = Date.now();
    for (const [id, res] of this.reservations.entries()) {
      if (res.expiresAt < now) {
        this.releaseReservation(id);
      }
    }
  }

  getBatches(): StockBatch[] {
    return Array.from(this.batches.values());
  }

  getReservations(): StockReservation[] {
    return Array.from(this.reservations.values());
  }
}
