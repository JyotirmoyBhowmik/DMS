import { KYCDocument, KYCDocumentType, KYCVerificationStatus } from '../../../domain/entities/kyc-document.js';
import { KYCDocumentPgRepository } from '../../../infrastructure/database/repositories/kyc-document.pg-repository.js';
import { Principal, RbacGuard } from '@dms/pkg-rbac';

export interface ListKYCDocumentsQuery {
  distributorId?: string;
  documentType?: KYCDocumentType;
  verificationStatus?: KYCVerificationStatus;
  page?: number;
  pageSize?: number;
}

export interface PaginatedKYCDocuments {
  data: KYCDocument[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export class ListKYCDocumentsUseCase {
  constructor(private kycRepo: KYCDocumentPgRepository) {}

  async execute(principal: Principal, query: ListKYCDocumentsQuery): Promise<PaginatedKYCDocuments> {
    // 1. Authorize permission
    if (!RbacGuard.can(principal, 'kyc_document:read') && !RbacGuard.can(principal, 'kyc-documents:read')) {
      throw new Error('Forbidden: Insufficient permissions to list KYC documents');
    }

    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 20));

    // 2. Fetch list based on filters
    let items: KYCDocument[] = [];
    if (query.distributorId && query.documentType) {
      const single = await this.kycRepo.findByDistributorAndType(principal.tenantId, query.distributorId, query.documentType);
      items = single ? [single] : [];
    } else if (query.distributorId) {
      items = await this.kycRepo.findByDistributor(principal.tenantId, query.distributorId);
    } else if (query.verificationStatus) {
      items = await this.kycRepo.findByStatus(principal.tenantId, query.verificationStatus);
    } else {
      // Return pending by default if no status specified
      items = await this.kycRepo.findByStatus(principal.tenantId, 'PENDING');
    }

    if (query.verificationStatus) {
      items = items.filter(d => d.verificationStatus === query.verificationStatus);
    }

    const total = items.length;
    const totalPages = Math.ceil(total / pageSize) || 1;
    const offset = (page - 1) * pageSize;
    const paginatedData = items.slice(offset, offset + pageSize);

    return {
      data: paginatedData,
      total,
      page,
      pageSize,
      totalPages,
    };
  }
}
