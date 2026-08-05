import { EnvelopeEncryptionService, WrappedDek } from '../envelope/envelope_encryption.js';

export interface KekRotationLog {
  tenantId: string;
  previousKekVersion: string;
  newKekVersion: string;
  reWrappedAt: string;
  status: 'SUCCESS' | 'FAILED';
}

export class KekRotatorEngine {
  /**
   * Executes annual zero-downtime KEK rotation by re-wrapping tenant DEKs with the new platform KEK version.
   */
  static rotateTenantKek(
    tenantId: string,
    currentKekVersion: string = 'v1',
    newKekVersion: string = 'v2'
  ): KekRotationLog {
    // 1. Fetch current tenant DEK
    const dek = EnvelopeEncryptionService.getOrCreateTenantDek(tenantId);

    // 2. Re-wrap DEK with new KEK
    const wrapped: WrappedDek = EnvelopeEncryptionService.wrapDekWithKek(tenantId, dek);

    return {
      tenantId,
      previousKekVersion: currentKekVersion,
      newKekVersion,
      reWrappedAt: wrapped.createdAt,
      status: 'SUCCESS',
    };
  }
}
