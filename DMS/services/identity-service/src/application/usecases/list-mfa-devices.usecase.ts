import { MFADeviceRepository, ListMFADevicesOptions } from '../../domain/repositories/mfa_device.repository.js';
import { MFADeviceAggregate, MFADeviceDomainError } from '../../domain/entities/mfa_device.entity.js';
import { Principal } from './create-user.usecase.js';

export class ListMFADevicesUseCase {
  constructor(private readonly repository: MFADeviceRepository) {}

  async execute(principal: Principal, options?: ListMFADevicesOptions): Promise<{ items: MFADeviceAggregate[]; total: number }> {
    if (!principal || !principal.tenantId) {
      throw new MFADeviceDomainError('Unauthorized: Principal tenant context is required');
    }

    const hasPermission = principal.permissions?.includes('identity:mfa:read') ||
                          principal.permissions?.includes('identity:*') ||
                          principal.roles?.includes('admin');
    if (!hasPermission) {
      throw new MFADeviceDomainError('Forbidden: Insufficient permissions to list MFA devices');
    }

    const page = Math.max(1, options?.page || 1);
    const limit = Math.min(100, Math.max(1, options?.limit || 20));

    return this.repository.list(principal.tenantId, {
      ...options,
      page,
      limit,
    });
  }
}
