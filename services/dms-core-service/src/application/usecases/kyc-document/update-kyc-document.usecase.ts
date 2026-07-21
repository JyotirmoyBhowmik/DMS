import { KYCDocument } from '../../../domain/entities/kyc-document.js';
import { KYCDocumentPgRepository } from '../../../infrastructure/database/repositories/kyc-document.pg-repository.js';
import { Principal, RbacGuard } from '@dms/pkg-rbac';
import { OutboxRepository, makeEnvelope } from '@dms/pkg-events';

export interface UpdateKYCDocumentInput {
  action: 'verify' | 'reject' | 'expire';
  verifiedBy?: string;
  expiresAt?: string;
  rejectionReason?: string;
  version: number;
}

export class UpdateKYCDocumentUseCase {
  private outboxRepo = new OutboxRepository({ tableName: 'dms_outbox' });

  constructor(private kycRepo: KYCDocumentPgRepository) {}

  async execute(
    principal: Principal,
    id: string,
    input: UpdateKYCDocumentInput
  ): Promise<KYCDocument> {
    // 1. Authorize permission
    if (!RbacGuard.can(principal, 'kyc_document:update')) {
      throw new Error('Forbidden: Insufficient permissions to update KYC document');
    }

    // 2. Fetch existing entity
    const existing = await this.kycRepo.findById(principal.tenantId, id);
    if (!existing || existing.tenantId !== principal.tenantId) {
      throw new Error(`KYCDocument with ID ${id} not found`);
    }

    // 3. Optimistic locking check
    if (input.version !== undefined && existing.version !== input.version) {
      throw new Error('409 Conflict: Optimistic locking failure, version mismatch');
    }

    // 4. Apply state transitions
    let eventType = 'distributor.kyc.updated';
    if (input.action === 'verify') {
      const verifier = input.verifiedBy || principal.id;
      existing.verify(verifier, input.expiresAt);
      eventType = 'distributor.kyc.verified';
    } else if (input.action === 'reject') {
      const reason = input.rejectionReason || 'Verification rejected by administrator';
      existing.reject(reason);
      eventType = 'distributor.kyc.rejected';
    } else if (input.action === 'expire') {
      existing.markExpired();
      eventType = 'distributor.kyc.expired';
    }

    // 5. Persist update to repository
    await this.kycRepo.save(existing);

    // 6. Record outbox event
    const eventEnvelope = makeEnvelope(
      eventType,
      'v1',
      {
        documentId: existing.id,
        distributorId: existing.distributorId,
        documentType: existing.documentType,
        verificationStatus: existing.verificationStatus,
        version: existing.version,
      },
      {
        tenantId: principal.tenantId,
        correlationId: principal.id,
        producer: 'dms-core-service',
        partitionKey: existing.id,
      }
    );

    try {
      await this.outboxRepo.save(
        null as any,
        {
          eventId: eventEnvelope.eventId,
          tenantId: existing.tenantId,
          type: eventEnvelope.type,
          version: 'v1',
          payload: eventEnvelope.payload,
        },
        'KYCDocument',
        existing.id
      );
    } catch {
      // Ignored if outbox table is offline
    }

    return existing;
  }
}
