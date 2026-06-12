import { MFADevice } from '../entities/mfa_device.js';
import { PaginatedResult, FindAllOptions } from '@dms/pkg-database';

export interface MFADeviceRepository {
  save(entity: MFADevice, tenantId: string): Promise<MFADevice>;
  findById(id: string, tenantId: string): Promise<MFADevice>;
  findAll(tenantId: string, options?: FindAllOptions): Promise<PaginatedResult<MFADevice>>;
  update(entity: MFADevice, tenantId: string): Promise<MFADevice>;
  delete(id: string, tenantId: string): Promise<boolean>;
  findByUserId(userId: string, tenantId: string): Promise<MFADevice[]>;
}
