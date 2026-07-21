import { CreateKYCDocumentUseCase } from '../../../application/usecases/kyc-document/create-kyc-document.usecase.js';
import { GetKYCDocumentUseCase } from '../../../application/usecases/kyc-document/get-kyc-document.usecase.js';
import { UpdateKYCDocumentUseCase } from '../../../application/usecases/kyc-document/update-kyc-document.usecase.js';
import { ListKYCDocumentsUseCase } from '../../../application/usecases/kyc-document/list-kyc-documents.usecase.js';
import { KYCDocumentPgRepository } from '../../../infrastructure/database/repositories/kyc-document.pg-repository.js';
import { CreateKYCDocumentSchema, VerifyKYCDocumentSchema, RejectKYCDocumentSchema } from '@dms/pkg-validation';
import { Principal } from '@dms/pkg-rbac';
import { StructuredLogger } from '@dms/pkg-logger';
import { PostgresDatabaseClient, PgDriver } from '@dms/pkg-database';
import { loadConfigSync } from '@dms/pkg-config';

const config = loadConfigSync();

export class KYCDocumentController {
  private db = new PostgresDatabaseClient(config.db, new PgDriver());
  private repo = new KYCDocumentPgRepository(this.db);
  private createUseCase = new CreateKYCDocumentUseCase(this.repo);
  private getUseCase = new GetKYCDocumentUseCase(this.repo);
  private updateUseCase = new UpdateKYCDocumentUseCase(this.repo);
  private listUseCase = new ListKYCDocumentsUseCase(this.repo);
  private logger = new StructuredLogger('KYCDocumentController');

  static clearStore(): void {
    KYCDocumentPgRepository.clearStore();
  }


  private buildPrincipal(headers: Record<string, string | undefined>): Principal {
    const tenantId = headers['x-tenant-id'] || '00000000-0000-0000-0000-000000000001';
    const roles = headers['x-user-roles'] ? (headers['x-user-roles'] as string).split(',') : ['admin'];
    return {
      id: headers['x-user-id'] || 'mock-user-uuid',
      tenantId,
      roles,
    };
  }

  async handleCreate(body: any, headers: Record<string, string | undefined>) {
    const tenantId = headers['x-tenant-id'] || '00000000-0000-0000-0000-000000000001';
    const idempotencyKey = headers['x-idempotency-key'];
    this.logger.info('Received HTTP POST KYC document request', { tenantId, idempotencyKey });
    const principal = this.buildPrincipal(headers);

    try {
      const parsed = CreateKYCDocumentSchema.parse(body);
      const doc = await this.createUseCase.execute(principal, parsed, idempotencyKey);

      return {
        statusCode: 201,
        body: {
          success: true,
          document: doc.toJSON(),
        },
      };
    } catch (err: any) {
      this.logger.warn('Validation or execution failed for create KYC document', { error: err.message });
      const isForbidden = err.message.includes('Forbidden') || err.message.includes('permission');
      const isConflict = err.message.includes('409 Conflict') || err.message.includes('already has');
      return {
        statusCode: isForbidden ? 403 : (isConflict ? 409 : 400),
        body: { success: false, error: err.message },
      };
    }
  }

  async handleGet(id: string, headers: Record<string, string | undefined>) {
    const principal = this.buildPrincipal(headers);
    try {
      const doc = await this.getUseCase.execute(principal, id);
      if (!doc) {
        return { statusCode: 404, body: { success: false, error: 'KYCDocument not found' } };
      }
      return { statusCode: 200, body: { success: true, document: doc.toJSON() } };
    } catch (err: any) {
      const isForbidden = err.message.includes('Forbidden');
      return { statusCode: isForbidden ? 403 : 400, body: { success: false, error: err.message } };
    }
  }

  async handleVerify(id: string, body: any, headers: Record<string, string | undefined>) {
    const principal = this.buildPrincipal(headers);
    try {
      const parsed = VerifyKYCDocumentSchema.parse(body);
      const updated = await this.updateUseCase.execute(principal, id, {
        action: 'verify',
        verifiedBy: parsed.verifiedBy,
        expiresAt: parsed.expiresAt,
        version: parsed.version,
      });
      return { statusCode: 200, body: { success: true, document: updated.toJSON() } };
    } catch (err: any) {
      const isForbidden = err.message.includes('Forbidden');
      const isConflict = err.message.includes('Conflict') || err.message.includes('version');
      const isNotFound = err.message.includes('not found');
      let statusCode = 400;
      if (isForbidden) statusCode = 403;
      else if (isConflict) statusCode = 409;
      else if (isNotFound) statusCode = 404;
      return { statusCode, body: { success: false, error: err.message } };
    }
  }

  async handleReject(id: string, body: any, headers: Record<string, string | undefined>) {
    const principal = this.buildPrincipal(headers);
    try {
      const parsed = RejectKYCDocumentSchema.parse(body);
      const updated = await this.updateUseCase.execute(principal, id, {
        action: 'reject',
        rejectionReason: parsed.rejectionReason,
        version: parsed.version,
      });
      return { statusCode: 200, body: { success: true, document: updated.toJSON() } };
    } catch (err: any) {
      const isForbidden = err.message.includes('Forbidden');
      const isConflict = err.message.includes('Conflict') || err.message.includes('version');
      const isNotFound = err.message.includes('not found');
      let statusCode = 400;
      if (isForbidden) statusCode = 403;
      else if (isConflict) statusCode = 409;
      else if (isNotFound) statusCode = 404;
      return { statusCode, body: { success: false, error: err.message } };
    }
  }

  async handleList(query: any, headers: Record<string, string | undefined>) {
    const principal = this.buildPrincipal(headers);
    try {
      const result = await this.listUseCase.execute(principal, {
        distributorId: query.distributorId,
        documentType: query.documentType,
        verificationStatus: query.verificationStatus,
        page: query.page ? Number(query.page) : 1,
        pageSize: query.pageSize ? Number(query.pageSize) : 20,
      });
      return {
        statusCode: 200,
        body: {
          success: true,
          ...result,
          data: result.data.map(d => d.toJSON()),
        },
      };
    } catch (err: any) {
      const isForbidden = err.message.includes('Forbidden');
      return { statusCode: isForbidden ? 403 : 400, body: { success: false, error: err.message } };
    }
  }
}
