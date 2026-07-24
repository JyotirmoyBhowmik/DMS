import { DebitNoteRepository, ListDebitNotesOptions, ListDebitNotesResult } from '../../../domain/repositories/debit-note.repository.js';
import { DebitNote, DebitNoteDomainError } from '../../../domain/entities/debit-note.entity.js';

export class DebitNotePgRepository implements DebitNoteRepository {
  private static inMemoryDb = new Map<string, DebitNote>();

  public static clearStore(): void {
    DebitNotePgRepository.inMemoryDb.clear();
  }

  async save(debitNote: DebitNote, tenantId: string): Promise<DebitNote> {
    if (tenantId !== debitNote.tenantId) {
      throw new DebitNoteDomainError('Tenant isolation violation on save');
    }

    // Check unique constraint (tenant_id, debit_note_number)
    for (const existing of DebitNotePgRepository.inMemoryDb.values()) {
      if (
        existing.tenantId === tenantId &&
        existing.debitNoteNumber === debitNote.debitNoteNumber &&
        existing.id !== debitNote.id
      ) {
        throw new DebitNoteDomainError(`DebitNote with number '${debitNote.debitNoteNumber}' already exists`);
      }
    }

    DebitNotePgRepository.inMemoryDb.set(debitNote.id, debitNote);
    return debitNote;
  }

  async findById(id: string, tenantId: string): Promise<DebitNote | null> {
    const found = DebitNotePgRepository.inMemoryDb.get(id);
    if (!found || found.tenantId !== tenantId) {
      return null;
    }
    return found;
  }

  async findByDebitNoteNumber(debitNoteNumber: string, tenantId: string): Promise<DebitNote | null> {
    for (const item of DebitNotePgRepository.inMemoryDb.values()) {
      if (item.tenantId === tenantId && item.debitNoteNumber === debitNoteNumber) {
        return item;
      }
    }
    return null;
  }

  async list(options: ListDebitNotesOptions, tenantId: string): Promise<ListDebitNotesResult> {
    const page = Math.max(1, options.page || 1);
    const limit = Math.min(100, Math.max(1, options.limit || 10));

    let items = Array.from(DebitNotePgRepository.inMemoryDb.values()).filter(
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
          i.debitNoteNumber.toLowerCase().includes(q) ||
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

  async update(debitNote: DebitNote, tenantId: string): Promise<DebitNote> {
    if (tenantId !== debitNote.tenantId) {
      throw new DebitNoteDomainError('Tenant isolation violation on update');
    }

    const existing = await this.findById(debitNote.id, tenantId);
    if (!existing) {
      throw new DebitNoteDomainError(`DebitNote with id '${debitNote.id}' not found`);
    }

    // Optimistic concurrency version check
    if (existing.version !== debitNote.version) {
      throw new DebitNoteDomainError(
        `Version conflict: Expected version ${existing.version}, got ${debitNote.version}`
      );
    }

    DebitNotePgRepository.inMemoryDb.set(debitNote.id, debitNote);
    return debitNote;
  }

  async delete(id: string, tenantId: string): Promise<void> {
    const existing = await this.findById(id, tenantId);
    if (existing) {
      DebitNotePgRepository.inMemoryDb.delete(id);
    }
  }
}
