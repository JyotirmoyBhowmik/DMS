import { CollectionRepository } from '../../domain/repositories/collection.repository.js';
import { Collection, CollectionDomainError } from '../../domain/entities/collection.entity.js';
import { UpdateCollectionDto } from '../dtos/collection.dto.js';
import { Principal } from './create-invoice.usecase.js';
import { validateUpdateCollectionInput } from '../../domain/validation/collection.validation.js';
import { CollectionAuditService } from '../../infrastructure/audit/collection.audit.js';

export class UpdateCollectionUseCase {
  private auditService = new CollectionAuditService();

  constructor(private readonly repository: CollectionRepository) {}

  async execute(principal: Principal, id: string, dto: UpdateCollectionDto, correlationId?: string): Promise<Collection> {
    if (!principal || !principal.tenantId) {
      throw new CollectionDomainError('Forbidden: Valid principal and tenantId are required');
    }

    const isApproveAction = dto.status === 'COLLECTED' || dto.status === 'CANCELLED';
    const requiredPermission = isApproveAction ? 'finance:collection:approve' : 'finance:collection:update';

    const hasPermission =
      principal.roles.includes('admin') ||
      principal.permissions.includes(requiredPermission) ||
      principal.permissions.includes('finance:collection:update') ||
      principal.permissions.includes('finance:*');

    if (!hasPermission) {
      throw new CollectionDomainError(`Forbidden: Insufficient permissions to update collection (${requiredPermission} required)`);
    }

    validateUpdateCollectionInput(dto);

    const existing = await this.repository.findById(id, principal.tenantId);
    if (!existing) {
      throw new CollectionDomainError(`Collection with id '${id}' not found`);
    }

    if (existing.version !== dto.version) {
      throw new CollectionDomainError(
        `Version conflict: Expected version ${existing.version}, got ${dto.version}`
      );
    }

    const oldValue = existing.toJSON();

    if (dto.status) {
      existing.transitionTo(dto.status);
    }

    const updated = await this.repository.update(existing, principal.tenantId);

    // Audit logging hook
    await this.auditService.recordMutation({
      tenantId: principal.tenantId,
      actorId: principal.userId,
      action: `COLLECTION_UPDATED_${dto.status || 'STATE'}`,
      entityType: 'Collection',
      entityId: updated.id,
      correlationId: correlationId || 'N/A',
      source: 'API',
      oldValue,
      newValue: updated.toJSON(),
    });

    return updated;
  }
}
