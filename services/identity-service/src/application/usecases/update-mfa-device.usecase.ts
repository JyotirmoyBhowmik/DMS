import { MFADeviceRepository } from '../../domain/repositories/mfa_device.repository.js';
import { UpdateMFADeviceInputDTO } from '../dtos/mfa_device.dto.js';
import { MFADeviceAggregate, MFADeviceDomainError } from '../../domain/entities/mfa_device.entity.js';
import { validateUpdateMFADeviceInput } from '../../domain/validation/mfa_device.validation.js';
import { MFADeviceAuditService } from '../../infrastructure/audit/mfa_device.audit.js';
import { Principal } from './create-user.usecase.js';

export class UpdateMFADeviceUseCase {
  constructor(private readonly repository: MFADeviceRepository) {}

  async execute(id: string, principal: Principal, dto: UpdateMFADeviceInputDTO): Promise<MFADeviceAggregate> {
    if (!principal || !principal.tenantId) {
      throw new MFADeviceDomainError('Unauthorized: Principal tenant context is required');
    }

    const hasPermission = principal.permissions?.includes('identity:mfa:update') ||
                          principal.permissions?.includes('identity:*') ||
                          principal.roles?.includes('admin');
    if (!hasPermission) {
      throw new MFADeviceDomainError('Forbidden: Insufficient permissions to update MFA device');
    }

    const validated = validateUpdateMFADeviceInput(dto);

    const existing = await this.repository.findById(id, principal.tenantId);
    if (!existing) {
      throw new MFADeviceDomainError(`MFADevice with id '${id}' not found`);
    }

    if (existing.version !== validated.version) {
      throw new MFADeviceDomainError(
        `Optimistic concurrency conflict for MFADevice '${id}': expected v${validated.version}, found v${existing.version}`
      );
    }

    const changes: Record<string, { old: any; new: any }> = {};

    if (validated.secretEncrypted) {
      changes.secretEncrypted = { old: '[REDACTED]', new: '[REDACTED]' };
      existing.updateSecret(validated.secretEncrypted);
    }

    if (validated.isActive !== undefined && validated.isActive !== existing.isActive) {
      changes.isActive = { old: existing.isActive, new: validated.isActive };
      if (validated.isActive) {
        existing.activate();
      } else {
        existing.deactivate();
      }
    }

    const updated = await this.repository.update(existing, principal.tenantId);

    MFADeviceAuditService.record({
      action: 'MFA_DEVICE_UPDATED',
      deviceId: updated.id,
      tenantId: principal.tenantId,
      actorUserId: principal.userId,
      changes,
    });

    return updated;
  }
}
