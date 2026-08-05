import { EInvoiceStatus } from '../../domain/entities/einvoice.entity.js';

export interface CreateEInvoiceDto {
  invoiceId: string;
  irn: string;
  qrCode?: string;
  acknowledgementNumber?: string;
  acknowledgementDate?: string;
  taxAmountCents?: number;
  totalAmountCents?: number;
  idempotencyKey?: string;
}

export interface UpdateEInvoiceDto {
  status: EInvoiceStatus;
  version: number;
}

export interface EInvoiceResponseDto {
  id: string;
  tenantId: string;
  invoiceId: string;
  irn: string;
  qrCode?: string;
  acknowledgementNumber?: string;
  acknowledgementDate?: string;
  taxAmountCents: number;
  totalAmountCents: number;
  status: EInvoiceStatus;
  idempotencyKey?: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}
