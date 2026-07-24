import { DebitNoteStatus } from '../../domain/entities/debit-note.entity.js';

export interface CreateDebitNoteDto {
  distributorId: string;
  invoiceId?: string;
  debitNoteNumber: string;
  amountCents: number;
  currency?: string;
  reason: string;
  idempotencyKey?: string;
}

export interface UpdateDebitNoteDto {
  status?: DebitNoteStatus;
  version: number;
}

export interface ListDebitNotesQueryDto {
  page?: number;
  limit?: number;
  status?: string;
  distributorId?: string;
  invoiceId?: string;
  search?: string;
  sortField?: string;
  sortOrder?: 'ASC' | 'DESC';
}

export interface DebitNoteResponseDto {
  id: string;
  tenantId: string;
  distributorId: string;
  invoiceId?: string;
  debitNoteNumber: string;
  amountCents: number;
  currency: string;
  reason: string;
  status: DebitNoteStatus;
  idempotencyKey?: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}
