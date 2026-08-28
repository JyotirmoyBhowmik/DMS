import { MFADeviceRepository } from '../../domain/repositories/mfa_device.repository.js';
import { CreateMFADeviceInputDTO } from '../dtos/mfa_device.dto.js';
import {
  MFADeviceAggregate,
  MFADeviceDomainError,
} from '../../domain/entities/mfa_device.entity.js';
import { validateCreateMFADeviceInput } from '../../domain/validation/mfa_device.validation.js';
import { MFADeviceAuditService } from '../../infrastructure/audit/mfa_device.audit.js';
import { Principal } from './create-user.usecase.js';

export class CreateMFADeviceUseCase {
  constructor(private readonly repository: MFADeviceRepository) {}

  async execute(
    principal: Principal,
    dto: CreateMFADeviceInputDTO,
    idempotencyKey?: string,
  ): Promise<MFADeviceAggregate> {
    if (!principal || !principal.tenantId) {
      throw new MFADeviceDomainError('Unauthorized: Principal tenant context is required');
    }

    const hasPermission =
      principal.permissions?.includes('identity:mfa:create') ||
      principal.permissions?.includes('identity:*') ||
      principal.roles?.includes('admin');
    if (!hasPermission) {
      throw new MFADeviceDomainError('Forbidden: Insufficient permissions to create MFA device');
    }

    const validated = validateCreateMFADeviceInput({
      ...dto,
      idempotencyKey: idempotencyKey || dto.idempotencyKey,
    });

    // Check uniqueness constraint: one MFA device of a given type per user
    if (this.repository.findByUserAndType) {
      const existing = await this.repository.findByUserAndType(
        validated.userId,
        validated.type,
        principal.tenantId,
      );
      if (existing) {
        if (idempotencyKey && existing.idempotencyKey === idempotencyKey) {
          return existing;
        }
        throw new MFADeviceDomainError(
          `Conflict: MFA device of type '${validated.type}' already exists for user '${validated.userId}'`,
        );
      }
    }

    const mfaDevice = new MFADeviceAggregate({
      tenantId: principal.tenantId,
      userId: validated.userId,
      type: validated.type,
      secretEncrypted: validated.secretEncrypted,
      isActive: validated.isActive,
      idempotencyKey: idempotencyKey || validated.idempotencyKey,
    });

    const saved = await this.repository.save(mfaDevice, principal.tenantId);

    MFADeviceAuditService.record({
      action: 'MFA_DEVICE_CREATED',
      deviceId: saved.id,
      tenantId: principal.tenantId,
      actorUserId: principal.userId,
      changes: {
        type: { old: null, new: saved.type },
        userId: { old: null, new: saved.userId },
      },
    });

    return saved;
  }
}
