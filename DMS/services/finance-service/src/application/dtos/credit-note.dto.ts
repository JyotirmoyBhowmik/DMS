import { CreditNoteStatus } from '../../domain/entities/credit-note.entity.js';

export interface CreateCreditNoteDto {
  distributorId: string;
  invoiceId?: string;
  creditNoteNumber: string;
  amountCents: number;
  currency?: string;
  reason: string;
  idempotencyKey?: string;
}

export interface UpdateCreditNoteDto {
  status?: CreditNoteStatus;
  version: number;
}

export interface ListCreditNotesQueryDto {
  page?: number;
  limit?: number;
  status?: string;
  distributorId?: string;
  invoiceId?: string;
  search?: string;
  sortField?: string;
  sortOrder?: 'ASC' | 'DESC';
}

export interface CreditNoteResponseDto {
  id: string;
  tenantId: string;
  distributorId: string;
  invoiceId?: string;
  creditNoteNumber: string;
  amountCents: number;
  currency: string;
  reason: string;
  status: CreditNoteStatus;
  idempotencyKey?: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}
