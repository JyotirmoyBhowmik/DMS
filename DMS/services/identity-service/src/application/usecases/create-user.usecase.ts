import { UserRepository } from '../../domain/repositories/user.repository.js';
import { UserAggregate, UserDomainError } from '../../domain/entities/user.entity.js';
import { CreateUserDto } from '../dtos/user.dto.js';
import { validateCreateUserInput } from '../../domain/validation/user.validation.js';
import { UserAuditService } from '../../infrastructure/audit/user.audit.js';

export interface Principal {
  userId: string;
  tenantId: string;
  roles: string[];
  permissions: string[];
}

export class CreateUserUseCase {
  private auditService = new UserAuditService();

  constructor(private readonly repository: UserRepository) {}

  async execute(
    principal: Principal,
    dto: CreateUserDto,
    idempotencyKey?: string,
    correlationId?: string,
  ): Promise<UserAggregate> {
    if (!principal || !principal.tenantId) {
      throw new UserDomainError('Forbidden: Valid principal and tenantId are required');
    }

    const hasPermission =
      principal.roles.includes('admin') ||
      principal.permissions.includes('identity:user:create') ||
      principal.permissions.includes('identity:*');

    if (!hasPermission) {
      throw new UserDomainError('Forbidden: Insufficient permissions to create User');
    }

    validateCreateUserInput(dto);

    const effectiveIdempotencyKey = idempotencyKey || dto.idempotencyKey;

    if (effectiveIdempotencyKey && this.repository.findByEmail) {
      const existing = await this.repository.findByEmail(dto.email, principal.tenantId);
      if (existing && existing.idempotencyKey === effectiveIdempotencyKey) {
        return existing;
      }
    }

    if (this.repository.findByEmail) {
      const duplicate = await this.repository.findByEmail(dto.email, principal.tenantId);
      if (duplicate) {
        throw new UserDomainError(`User with email '${dto.email}' already exists`);
      }
    }

    const user = new UserAggregate({
      tenantId: principal.tenantId,
      email: dto.email,
      passwordHash: dto.passwordHash,
      firstName: dto.firstName,
      lastName: dto.lastName,
      roles: dto.roles || ['user'],
      status: 'ACTIVE',
      idempotencyKey: effectiveIdempotencyKey,
      version: 1,
    });

    const saved = await this.repository.save(user, principal.tenantId);

    // Audit trail (redacts passwordHash)
    await this.auditService.recordMutation({
      tenantId: principal.tenantId,
      actorId: principal.userId,
      action: 'USER_CREATED',
      entityType: 'User',
      entityId: saved.id,
      correlationId: correlationId || 'N/A',
      source: 'API',
      newValue: saved.toJSON(true),
    });

    return saved;
  }
}
