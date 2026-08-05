import { Payment } from '../entities/payment.entity.js';

export interface ListPaymentsOptions {
  page?: number;
  limit?: number;
  status?: string;
  distributorId?: string;
  invoiceId?: string;
  search?: string;
  sortField?: string;
  sortOrder?: 'ASC' | 'DESC';
}

export interface ListPaymentsResult {
  data: Payment[];
  total: number;
  page: number;
  limit: number;
}

export interface PaymentRepository {
  save(payment: Payment, tenantId: string): Promise<Payment>;
  findById(id: string, tenantId: string): Promise<Payment | null>;
  findByPaymentReference(paymentReference: string, tenantId: string): Promise<Payment | null>;
  list(options: ListPaymentsOptions, tenantId: string): Promise<ListPaymentsResult>;
  update(payment: Payment, tenantId: string): Promise<Payment>;
  delete(id: string, tenantId: string): Promise<void>;
}
