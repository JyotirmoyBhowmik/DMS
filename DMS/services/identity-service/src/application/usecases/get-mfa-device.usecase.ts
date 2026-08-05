import { MFADeviceRepository } from '../../domain/repositories/mfa_device.repository.js';
import { MFADeviceAggregate, MFADeviceDomainError } from '../../domain/entities/mfa_device.entity.js';
import { Principal } from './create-user.usecase.js';

export class GetMFADeviceUseCase {
  constructor(private readonly repository: MFADeviceRepository) {}

  async execute(id: string, principal: Principal): Promise<MFADeviceAggregate> {
    if (!principal || !principal.tenantId) {
      throw new MFADeviceDomainError('Unauthorized: Principal tenant context is required');
    }

    const hasPermission = principal.permissions?.includes('identity:mfa:read') ||
                          principal.permissions?.includes('identity:*') ||
                          principal.roles?.includes('admin');
    if (!hasPermission) {
      throw new MFADeviceDomainError('Forbidden: Insufficient permissions to view MFA device');
    }

    const device = await this.repository.findById(id, principal.tenantId);
    if (!device) {
      throw new MFADeviceDomainError(`MFADevice with id '${id}' not found`);
    }

    return device;
  }
}
