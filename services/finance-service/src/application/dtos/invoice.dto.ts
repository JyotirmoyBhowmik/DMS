import { InvoiceStatus } from '../../domain/entities/invoice.entity.js';

export interface CreateInvoiceItemDto {
  productId: string;
  description: string;
  quantity: number;
  unitPriceCents: number;
  totalAmountCents?: number;
}

export interface CreateInvoiceDto {
  distributorId: string;
  orderId?: string;
  invoiceNumber: string;
  grossAmountCents?: number;
  discountAmountCents?: number;
  taxAmountCents?: number;
  netAmountCents?: number;
  currency?: string;
  dueDate: string;
  idempotencyKey?: string;
  items?: CreateInvoiceItemDto[];
}

export interface UpdateInvoiceDto {
  status?: InvoiceStatus;
  paidAt?: string;
  version: number;
}

export interface ListInvoicesQueryDto {
  page?: number;
  limit?: number;
  status?: string;
  distributorId?: string;
  search?: string;
  sortField?: string;
  sortOrder?: 'ASC' | 'DESC';
}

export interface InvoiceItemResponseDto {
  id: string;
  productId: string;
  description: string;
  quantity: number;
  unitPriceCents: number;
  totalAmountCents: number;
}

export interface InvoiceResponseDto {
  id: string;
  tenantId: string;
  distributorId: string;
  orderId?: string;
  invoiceNumber: string;
  grossAmountCents: number;
  discountAmountCents: number;
  taxAmountCents: number;
  netAmountCents: number;
  currency: string;
  status: InvoiceStatus;
  dueDate: string;
  paidAt?: string | null;
  idempotencyKey?: string;
  items: InvoiceItemResponseDto[];
  version: number;
  createdAt: string;
  updatedAt: string;
}
