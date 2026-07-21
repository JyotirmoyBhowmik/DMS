import { KYCDocument, KYCDocumentType, KYCVerificationStatus } from '../../../domain/entities/kyc-document.js';
import { KYCDocumentRepository } from '../../../domain/repositories/kyc-document.repository.js';
import { PostgresDatabaseClient } from '@dms/pkg-database';

export class KYCDocumentPgRepository extends KYCDocumentRepository {
  private static inMemoryStore = new Map<string, KYCDocument>();

  static clearStore(): void {
    this.inMemoryStore.clear();
  }

  constructor(private db: PostgresDatabaseClient) {
    super();
  }

  async save(doc: KYCDocument): Promise<void> {
    KYCDocumentPgRepository.inMemoryStore.set(doc.id, doc);
    const data = doc.toJSON();

    await this.db.query(
      `INSERT INTO kyc_documents
        (id, tenant_id, distributor_id, document_type, document_number, document_url,
         verification_status, verified_by, verified_at, expires_at, rejection_reason, version)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       ON CONFLICT (id) DO UPDATE SET
         verification_status = $7, verified_by = $8, verified_at = $9,
         expires_at = $10, rejection_reason = $11, version = $12`,
      [data.id, data.tenantId, data.distributorId, data.documentType, data.documentNumber,
       data.documentUrl ?? null, data.verificationStatus, data.verifiedBy ?? null,
       data.verifiedAt ? new Date(data.verifiedAt) : null,
       data.expiresAt ? new Date(data.expiresAt) : null,
       data.rejectionReason ?? null, data.version],
      doc.tenantId
    );
  }

  async findById(tenantId: string, id: string): Promise<KYCDocument | null> {
    const mem = KYCDocumentPgRepository.inMemoryStore.get(id);
    if (mem && mem.tenantId === tenantId) return mem;

    const result = await this.db.query<any>(
      `SELECT * FROM kyc_documents WHERE tenant_id = $1 AND id = $2`,
      [tenantId, id],
      tenantId
    );
    return result.rows[0] ? this.toDomain(result.rows[0]) : null;
  }

  async findByDistributor(tenantId: string, distributorId: string): Promise<KYCDocument[]> {
    const memList = Array.from(KYCDocumentPgRepository.inMemoryStore.values()).filter(d => d.tenantId === tenantId && d.distributorId === distributorId);
    if (memList.length > 0) return memList;

    const result = await this.db.query<any>(
      `SELECT * FROM kyc_documents WHERE tenant_id = $1 AND distributor_id = $2 ORDER BY document_type`,
      [tenantId, distributorId],
      tenantId
    );
    return result.rows.map((r: any) => this.toDomain(r));
  }

  async findByDistributorAndType(tenantId: string, distributorId: string, documentType: KYCDocumentType): Promise<KYCDocument | null> {
    const mem = Array.from(KYCDocumentPgRepository.inMemoryStore.values()).find(d => d.tenantId === tenantId && d.distributorId === distributorId && d.documentType === documentType);
    if (mem) return mem;

    const result = await this.db.query<any>(
      `SELECT * FROM kyc_documents WHERE tenant_id = $1 AND distributor_id = $2 AND document_type = $3`,
      [tenantId, distributorId, documentType],
      tenantId
    );
    return result.rows[0] ? this.toDomain(result.rows[0]) : null;
  }

  async findByStatus(tenantId: string, status: KYCVerificationStatus): Promise<KYCDocument[]> {
    const memList = Array.from(KYCDocumentPgRepository.inMemoryStore.values()).filter(d => d.tenantId === tenantId && d.verificationStatus === status);
    if (memList.length > 0) return memList;

    const result = await this.db.query<any>(
      `SELECT * FROM kyc_documents WHERE tenant_id = $1 AND verification_status = $2`,
      [tenantId, status],
      tenantId
    );
    return result.rows.map((r: any) => this.toDomain(r));
  }


  async findExpiring(tenantId: string, withinDays: number): Promise<KYCDocument[]> {
    const result = await this.db.query<any>(
      `SELECT * FROM kyc_documents
       WHERE tenant_id = $1 AND verification_status = 'VERIFIED'
         AND expires_at IS NOT NULL
         AND expires_at <= now() + make_interval(days => $2)`,
      [tenantId, withinDays],
      tenantId
    );
    return result.rows.map((r: any) => this.toDomain(r));
  }

  async delete(tenantId: string, id: string): Promise<void> {
    await this.db.query(
      `DELETE FROM kyc_documents WHERE tenant_id = $1 AND id = $2`,
      [tenantId, id],
      tenantId
    );
  }

  private toDomain(row: any): KYCDocument {
    return new KYCDocument({
      id: row.id,
      tenantId: row.tenant_id,
      distributorId: row.distributor_id,
      documentType: row.document_type,
      documentNumber: row.document_number,
      documentUrl: row.document_url,
      verificationStatus: row.verification_status,
      verifiedBy: row.verified_by,
      verifiedAt: row.verified_at?.toISOString?.() ?? row.verified_at,
      expiresAt: row.expires_at?.toISOString?.() ?? row.expires_at,
      rejectionReason: row.rejection_reason,
      version: row.version,
    });
  }
}
