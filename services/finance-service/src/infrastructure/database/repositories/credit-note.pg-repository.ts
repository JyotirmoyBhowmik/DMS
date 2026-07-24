import { CreditNoteRepository, ListCreditNotesOptions, ListCreditNotesResult } from '../../../domain/repositories/credit-note.repository.js';
import { CreditNote, CreditNoteDomainError } from '../../../domain/entities/credit-note.entity.js';

export class CreditNotePgRepository implements CreditNoteRepository {
  private static inMemoryDb = new Map<string, CreditNote>();

  public static clearStore(): void {
    CreditNotePgRepository.inMemoryDb.clear();
  }

  async save(creditNote: CreditNote, tenantId: string): Promise<CreditNote> {
    if (tenantId !== creditNote.tenantId) {
      throw new CreditNoteDomainError('Tenant isolation violation on save');
    }

    // Check unique constraint (tenant_id, credit_note_number)
    for (const existing of CreditNotePgRepository.inMemoryDb.values()) {
      if (
        existing.tenantId === tenantId &&
        existing.creditNoteNumber === creditNote.creditNoteNumber &&
        existing.id !== creditNote.id
      ) {
        throw new CreditNoteDomainError(`CreditNote with number '${creditNote.creditNoteNumber}' already exists`);
      }
    }

    CreditNotePgRepository.inMemoryDb.set(creditNote.id, creditNote);
    return creditNote;
  }

  async findById(id: string, tenantId: string): Promise<CreditNote | null> {
    const found = CreditNotePgRepository.inMemoryDb.get(id);
    if (!found || found.tenantId !== tenantId) {
      return null;
    }
    return found;
  }

  async findByCreditNoteNumber(creditNoteNumber: string, tenantId: string): Promise<CreditNote | null> {
    for (const item of CreditNotePgRepository.inMemoryDb.values()) {
      if (item.tenantId === tenantId && item.creditNoteNumber === creditNoteNumber) {
        return item;
      }
    }
    return null;
  }

  async list(options: ListCreditNotesOptions, tenantId: string): Promise<ListCreditNotesResult> {
    const page = Math.max(1, options.page || 1);
    const limit = Math.min(100, Math.max(1, options.limit || 10));

    let items = Array.from(CreditNotePgRepository.inMemoryDb.values()).filter(
      item => item.tenantId === tenantId
    );

    if (options.status) {
      items = items.filter(i => i.status === options.status);
    }

    if (options.distributorId) {
      items = items.filter(i => i.distributorId === options.distributorId);
    }

    if (options.invoiceId) {
      items = items.filter(i => i.invoiceId === options.invoiceId);
    }

    if (options.search) {
      const q = options.search.toLowerCase();
      items = items.filter(
        i =>
          i.creditNoteNumber.toLowerCase().includes(q) ||
          i.reason.toLowerCase().includes(q) ||
          i.distributorId.toLowerCase().includes(q)
      );
    }

    const sortField = options.sortField || 'createdAt';
    const sortOrder = options.sortOrder === 'ASC' ? 1 : -1;

    items.sort((a, b) => {
      let valA: any = (a as any)[sortField];
      let valB: any = (b as any)[sortField];
      if (valA instanceof Date) valA = valA.getTime();
      if (valB instanceof Date) valB = valB.getTime();
      if (valA < valB) return -1 * sortOrder;
      if (valA > valB) return 1 * sortOrder;
      return 0;
    });

    const total = items.length;
    const startIndex = (page - 1) * limit;
    const paginated = items.slice(startIndex, startIndex + limit);

    return {
      data: paginated,
      total,
      page,
      limit,
    };
  }

  async update(creditNote: CreditNote, tenantId: string): Promise<CreditNote> {
    if (tenantId !== creditNote.tenantId) {
      throw new CreditNoteDomainError('Tenant isolation violation on update');
    }

    const existing = await this.findById(creditNote.id, tenantId);
    if (!existing) {
      throw new CreditNoteDomainError(`CreditNote with id '${creditNote.id}' not found`);
    }

    // Optimistic concurrency version check
    if (existing.version !== creditNote.version) {
      throw new CreditNoteDomainError(
        `Version conflict: Expected version ${existing.version}, got ${creditNote.version}`
      );
    }

    CreditNotePgRepository.inMemoryDb.set(creditNote.id, creditNote);
    return creditNote;
  }

  async delete(id: string, tenantId: string): Promise<void> {
    const existing = await this.findById(id, tenantId);
    if (existing) {
      CreditNotePgRepository.inMemoryDb.delete(id);
    }
  }
}
