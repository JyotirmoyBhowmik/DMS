import { CollectionRepository } from '../../domain/repositories/collection.repository.js';
import { Collection, CollectionDomainError } from '../../domain/entities/collection.entity.js';
import { CreateCollectionDto } from '../dtos/collection.dto.js';
import { validateCreateCollectionInput } from '../../domain/validation/collection.validation.js';
import { Principal } from './create-invoice.usecase.js';
import { CollectionAuditService } from '../../infrastructure/audit/collection.audit.js';

export class CreateCollectionUseCase {
  private auditService = new CollectionAuditService();

  constructor(private readonly repository: CollectionRepository) {}

  async execute(principal: Principal, dto: CreateCollectionDto, idempotencyKey?: string, correlationId?: string): Promise<Collection> {
    if (!principal || !principal.tenantId) {
      throw new CollectionDomainError('Forbidden: Valid principal and tenantId are required');
    }

    const hasPermission =
      principal.roles.includes('admin') ||
      principal.permissions.includes('finance:collection:create') ||
      principal.permissions.includes('finance:*');

    if (!hasPermission) {
      throw new CollectionDomainError('Forbidden: Insufficient permissions to create collection (finance:collection:create required)');
    }

    validateCreateCollectionInput(dto);

    const effectiveIdempotencyKey = idempotencyKey || dto.idempotencyKey;

    if (effectiveIdempotencyKey) {
      const existing = await this.repository.findByCollectionReference(dto.collectionReference, principal.tenantId);
      if (existing && existing.idempotencyKey === effectiveIdempotencyKey) {
        return existing;
      }
    }

    const duplicate = await this.repository.findByCollectionReference(dto.collectionReference, principal.tenantId);
    if (duplicate) {
      throw new CollectionDomainError(`Collection with reference '${dto.collectionReference}' already exists`);
    }

    const collection = new Collection({
      tenantId: principal.tenantId,
      distributorId: dto.distributorId,
      invoiceId: dto.invoiceId,
      collectionReference: dto.collectionReference,
      amountCents: dto.amountCents,
      collectionMode: dto.collectionMode || 'CASH',
      currency: dto.currency || 'USD',
      status: 'DRAFT',
      idempotencyKey: effectiveIdempotencyKey,
      version: 1,
    });

    const saved = await this.repository.save(collection, principal.tenantId);

    // Audit logging hook
    await this.auditService.recordMutation({
      tenantId: principal.tenantId,
      actorId: principal.userId,
      action: 'COLLECTION_CREATED',
      entityType: 'Collection',
      entityId: saved.id,
      correlationId: correlationId || 'N/A',
      source: 'API',
      newValue: saved.toJSON(),
    });

    return saved;
  }
}
