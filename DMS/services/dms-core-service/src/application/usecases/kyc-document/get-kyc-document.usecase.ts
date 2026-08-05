import { KYCDocument } from '../../../domain/entities/kyc-document.js';
import { KYCDocumentPgRepository } from '../../../infrastructure/database/repositories/kyc-document.pg-repository.js';
import { Principal, RbacGuard } from '@dms/pkg-rbac';

export class GetKYCDocumentUseCase {
  constructor(private kycRepo: KYCDocumentPgRepository) {}

  async execute(principal: Principal, id: string): Promise<KYCDocument | null> {
    // 1. Authorize read permission
    if (!RbacGuard.can(principal, 'kyc_document:read') && !RbacGuard.can(principal, 'kyc-documents:read')) {
      throw new Error('Forbidden: Insufficient permissions to read KYC document');
    }

    // 2. Query repository scoped to tenant
    const doc = await this.kycRepo.findById(principal.tenantId, id);

    // 3. Prevent cross-tenant existence leakage
    if (!doc || doc.tenantId !== principal.tenantId) {
      return null;
    }

    return doc;
  }
}
