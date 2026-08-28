import { MFADeviceAggregate, MfaType } from '../entities/mfa_device.entity.js';

export interface ListMFADevicesOptions {
  page?: number;
  limit?: number;
  type?: MfaType;
  isActive?: boolean;
  userId?: string;
  sortBy?: 'createdAt' | 'type' | 'userId';
  sortOrder?: 'ASC' | 'DESC';
}

export interface MFADeviceRepository {
  save(mfaDevice: MFADeviceAggregate, tenantId: string): Promise<MFADeviceAggregate>;
  findById(id: string, tenantId: string): Promise<MFADeviceAggregate | null>;
  findByUserAndType?(
    userId: string,
    type: MfaType,
    tenantId: string,
  ): Promise<MFADeviceAggregate | null>;
  list(
    tenantId: string,
    options?: ListMFADevicesOptions,
  ): Promise<{ items: MFADeviceAggregate[]; total: number }>;
  update(mfaDevice: MFADeviceAggregate, tenantId: string): Promise<MFADeviceAggregate>;
  delete(id: string, tenantId: string): Promise<boolean>;
}
