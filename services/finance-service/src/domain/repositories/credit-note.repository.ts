import { CreditNote } from '../entities/credit-note.entity.js';

export interface ListCreditNotesOptions {
  page?: number;
  limit?: number;
  status?: string;
  distributorId?: string;
  invoiceId?: string;
  search?: string;
  sortField?: string;
  sortOrder?: 'ASC' | 'DESC';
}

export interface ListCreditNotesResult {
  data: CreditNote[];
  total: number;
  page: number;
  limit: number;
}

export interface CreditNoteRepository {
  save(creditNote: CreditNote, tenantId: string): Promise<CreditNote>;
  findById(id: string, tenantId: string): Promise<CreditNote | null>;
  findByCreditNoteNumber(creditNoteNumber: string, tenantId: string): Promise<CreditNote | null>;
  list(options: ListCreditNotesOptions, tenantId: string): Promise<ListCreditNotesResult>;
  update(creditNote: CreditNote, tenantId: string): Promise<CreditNote>;
  delete(id: string, tenantId: string): Promise<void>;
}
