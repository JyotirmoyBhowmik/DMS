import { MfaType } from '../../domain/entities/mfa_device.entity.js';

export interface CreateMFADeviceInputDTO {
  userId: string;
  type: MfaType;
  secretEncrypted: string;
  isActive?: boolean;
  idempotencyKey?: string;
}

export interface UpdateMFADeviceInputDTO {
  secretEncrypted?: string;
  isActive?: boolean;
  version: number;
}

export interface MFADeviceResponseDTO {
  id: string;
  tenantId: string;
  userId: string;
  type: MfaType;
  secretEncrypted: string;
  isActive: boolean;
  lastUsedAt: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
}
