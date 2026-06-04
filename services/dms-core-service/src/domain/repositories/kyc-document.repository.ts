/**
 * KYCDocument Repository Interface (Port).
 */
import { KYCDocument, KYCDocumentType, KYCVerificationStatus } from '../entities/kyc-document.js';

export abstract class KYCDocumentRepository {
  abstract save(document: KYCDocument): Promise<void>;
  abstract findById(tenantId: string, id: string): Promise<KYCDocument | null>;
  abstract findByDistributor(tenantId: string, distributorId: string): Promise<KYCDocument[]>;
  abstract findByDistributorAndType(tenantId: string, distributorId: string, documentType: KYCDocumentType): Promise<KYCDocument | null>;
  abstract findByStatus(tenantId: string, status: KYCVerificationStatus): Promise<KYCDocument[]>;
  abstract findExpiring(tenantId: string, withinDays: number): Promise<KYCDocument[]>;
  abstract delete(tenantId: string, id: string): Promise<void>;
}
