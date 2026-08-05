import { PaymentStatus } from '../../domain/entities/payment.entity.js';

export interface CreatePaymentDto {
  distributorId: string;
  invoiceId?: string;
  paymentReference: string;
  amountCents: number;
  paymentMethod?: string;
  currency?: string;
  idempotencyKey?: string;
}

export interface UpdatePaymentDto {
  status?: PaymentStatus;
  version: number;
}

export interface ListPaymentsQueryDto {
  page?: number;
  limit?: number;
  status?: string;
  distributorId?: string;
  invoiceId?: string;
  search?: string;
  sortField?: string;
  sortOrder?: 'ASC' | 'DESC';
}

export interface PaymentResponseDto {
  id: string;
  tenantId: string;
  distributorId: string;
  invoiceId?: string;
  paymentReference: string;
  amountCents: number;
  paymentMethod: string;
  currency: string;
  status: PaymentStatus;
  idempotencyKey?: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}
