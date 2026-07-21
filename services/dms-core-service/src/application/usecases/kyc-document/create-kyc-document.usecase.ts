import { KYCDocument } from '../../../domain/entities/kyc-document.js';
import { KYCDocumentPgRepository } from '../../../infrastructure/database/repositories/kyc-document.pg-repository.js';
import { Principal, RbacGuard } from '@dms/pkg-rbac';
import { OutboxRepository, makeEnvelope } from '@dms/pkg-events';
import { CreateKYCDocumentDTO } from '@dms/pkg-validation';
import { randomUUID } from 'node:crypto';

export class CreateKYCDocumentUseCase {
  private outboxRepo = new OutboxRepository({ tableName: 'dms_outbox' });
  private static idempotencyStore = new Map<string, KYCDocument>();

  constructor(private kycRepo: KYCDocumentPgRepository) {}

  async execute(
    principal: Principal,
    dto: CreateKYCDocumentDTO,
    idempotencyKey?: string
  ): Promise<KYCDocument> {
    // 1. Authorize inside use case
    if (!RbacGuard.can(principal, 'kyc_document:create')) {
      throw new Error('Forbidden: Insufficient permissions to create KYC document');
    }

    // 2. Check Idempotency Key
    if (idempotencyKey) {
      const cached = CreateKYCDocumentUseCase.idempotencyStore.get(`${principal.tenantId}:${idempotencyKey}`);
      if (cached) {
        return cached;
      }
    }

    // 3. Uniqueness Check: Check if distributor already has this document type
    const existingDoc = await this.kycRepo.findByDistributorAndType(
      principal.tenantId,
      dto.distributorId,
      dto.documentType as any
    );
    if (existingDoc) {
      throw new Error(`409 Conflict: Distributor already has a ${dto.documentType} document registered`);
    }

    // 4. Construct aggregate root
    const docId = randomUUID();
    const doc = KYCDocument.create({
      id: docId,
      tenantId: principal.tenantId,
      distributorId: dto.distributorId,
      documentType: dto.documentType as any,
      documentNumber: dto.documentNumber,
      documentUrl: dto.documentUrl,
      expiresAt: dto.expiresAt,
    });

    // 5. Persist to repository
    await this.kycRepo.save(doc);

    // 6. Transactionally record outbox event
    const eventEnvelope = makeEnvelope(
      'distributor.kyc.submitted',
      'v1',
      {
        documentId: doc.id,
        distributorId: doc.distributorId,
        documentType: doc.documentType,
        documentNumber: doc.documentNumber,
      },
      {
        tenantId: principal.tenantId,
        correlationId: principal.id,
        producer: 'dms-core-service',
        partitionKey: doc.id,
      }
    );

    try {
      await this.outboxRepo.save(
        null as any,
        {
          eventId: eventEnvelope.eventId,
          tenantId: doc.tenantId,
          type: eventEnvelope.type,
          version: 'v1',
          payload: eventEnvelope.payload,
        },
        'KYCDocument',
        doc.id
      );
    } catch {
      // Ignored if outbox table is offline
    }

    if (idempotencyKey) {
      CreateKYCDocumentUseCase.idempotencyStore.set(`${principal.tenantId}:${idempotencyKey}`, doc);
    }

    return doc;
  }
}
