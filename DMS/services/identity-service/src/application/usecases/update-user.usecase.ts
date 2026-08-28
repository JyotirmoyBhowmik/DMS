import { UserRepository } from '../../domain/repositories/user.repository.js';
import { UserAggregate, UserDomainError } from '../../domain/entities/user.entity.js';
import { UpdateUserDto } from '../dtos/user.dto.js';
import { validateUpdateUserInput } from '../../domain/validation/user.validation.js';
import { Principal } from './create-user.usecase.js';
import { UserAuditService } from '../../infrastructure/audit/user.audit.js';

export class UpdateUserUseCase {
  private auditService = new UserAuditService();

  constructor(private readonly repository: UserRepository) {}

  async execute(
    id: string,
    principal: Principal,
    dto: UpdateUserDto,
    correlationId?: string,
  ): Promise<UserAggregate> {
    if (!principal || !principal.tenantId) {
      throw new UserDomainError('Forbidden: Valid principal and tenantId are required');
    }

    const hasPermission =
      principal.roles.includes('admin') ||
      principal.permissions.includes('identity:user:update') ||
      principal.permissions.includes('identity:*');

    if (!hasPermission) {
      throw new UserDomainError('Forbidden: Insufficient permissions to update User');
    }

    validateUpdateUserInput(dto);

    const existing = await this.repository.findById(id, principal.tenantId);
    if (!existing) {
      throw new UserDomainError(`User with id '${id}' not found`);
    }

    if (dto.version !== undefined && existing.version !== dto.version) {
      throw new UserDomainError(
        `Optimistic locking conflict: User version is ${existing.version}, provided version is ${dto.version}`,
      );
    }

    const oldValue = existing.toJSON(true);

    if (dto.status) {
      existing.transitionTo(dto.status);
    }

    const updated = await this.repository.update(existing, principal.tenantId);

    // Audit trail
    await this.auditService.recordMutation({
      tenantId: principal.tenantId,
      actorId: principal.userId,
      action: `USER_UPDATED_${dto.status || 'PROFILE'}`,
      entityType: 'User',
      entityId: updated.id,
      correlationId: correlationId || 'N/A',
      source: 'API',
      oldValue,
      newValue: updated.toJSON(true),
    });

    return updated;
  }
}
