import { EWayBillStatus } from '../../domain/entities/ewaybill.entity.js';

export interface CreateEWayBillDto {
  invoiceId: string;
  ewayBillNumber: string;
  validUntil?: string;
  vehicleNumber?: string;
  transporterId?: string;
  distanceKm?: number;
  idempotencyKey?: string;
}

export interface UpdateEWayBillDto {
  status: EWayBillStatus;
  version: number;
}

export interface EWayBillResponseDto {
  id: string;
  tenantId: string;
  invoiceId: string;
  ewayBillNumber: string;
  validUntil?: string;
  vehicleNumber?: string;
  transporterId?: string;
  distanceKm: number;
  status: EWayBillStatus;
  idempotencyKey?: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}
