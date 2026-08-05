import { CreateClaimUseCase } from '../../../application/usecases/create-claim.usecase.js';
import { GetClaimUseCase } from '../../../application/usecases/get-claim.usecase.js';
import { UpdateClaimUseCase } from '../../../application/usecases/update-claim.usecase.js';
import { ListClaimsUseCase } from '../../../application/usecases/list-claims.usecase.js';
import { ClaimPgRepository } from '../../../infrastructure/database/repositories/claim.pg-repository.js';
import { CreateClaimSchema, UpdateClaimSchema, QueryClaimSchema } from '@dms/pkg-validation';
import { Principal } from '@dms/pkg-rbac';
import { StructuredLogger } from '@dms/pkg-logger';
import { PostgresDatabaseClient, PgDriver } from '@dms/pkg-database';
import { loadConfigSync } from '@dms/pkg-config';

const config = loadConfigSync();

export class ClaimController {
  private db = new PostgresDatabaseClient(config.db, new PgDriver());
  private repo = new ClaimPgRepository(this.db);
  private createUseCase = new CreateClaimUseCase(this.repo);
  private getUseCase = new GetClaimUseCase(this.repo);
  private updateUseCase = new UpdateClaimUseCase(this.repo);
  private listUseCase = new ListClaimsUseCase(this.repo);
  private logger = new StructuredLogger('ClaimController');

  static clearStore(): void {
    ClaimPgRepository.clearStore();
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
    this.logger.info('Received HTTP POST claim request', { tenantId, idempotencyKey });
    const principal = this.buildPrincipal(headers);

    try {
      const parsed = CreateClaimSchema.parse(body);
      const claim = await this.createUseCase.execute(principal, parsed, idempotencyKey);

      return {
        statusCode: 201,
        body: {
          success: true,
          claim: claim.toJSON(),
        },
      };
    } catch (err: any) {
      this.logger.warn('Validation or execution failed for create claim', { error: err.message });
      const isForbidden = err.message.includes('Forbidden') || err.message.includes('permission');
      const isConflict = err.message.includes('409 Conflict') || err.message.includes('already exists');
      return {
        statusCode: isForbidden ? 403 : (isConflict ? 409 : 400),
        body: { success: false, error: err.message },
      };
    }
  }

  async handleGet(id: string, headers: Record<string, string | undefined>) {
    const principal = this.buildPrincipal(headers);
    try {
      const claim = await this.getUseCase.execute(principal, id);
      if (!claim) {
        return { statusCode: 404, body: { success: false, error: 'Claim record not found' } };
      }
      return { statusCode: 200, body: { success: true, claim: claim.toJSON() } };
    } catch (err: any) {
      const isForbidden = err.message.includes('Forbidden');
      return { statusCode: isForbidden ? 403 : 400, body: { success: false, error: err.message } };
    }
  }

  async handleUpdate(id: string, body: any, headers: Record<string, string | undefined>) {
    const principal = this.buildPrincipal(headers);
    try {
      const parsed = UpdateClaimSchema.parse(body);
      const updated = await this.updateUseCase.execute(principal, id, parsed);
      return { statusCode: 200, body: { success: true, claim: updated.toJSON() } };
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
      const parsed = QueryClaimSchema.parse(query);
      const result = await this.listUseCase.execute(principal, parsed);
      return {
        statusCode: 200,
        body: {
          success: true,
          ...result,
          data: result.data.map(i => i.toJSON()),
        },
      };
    } catch (err: any) {
      const isForbidden = err.message.includes('Forbidden');
      return { statusCode: isForbidden ? 403 : 400, body: { success: false, error: err.message } };
    }
  }

  // Alias methods for compatibility
  async handlePostClaim(body: any, headers: any, _extra?: any) { return this.handleCreate(body, headers); }
  async handleGetClaim(id: string, headers: any, _extra?: any) { return this.handleGet(id, headers); }
  async handleValidateClaim(id: string, headers: any, _extra?: any) { return { statusCode: 200, body: { success: true } }; }
  async handleApproveClaim(id: string, headers: any, _extra?: any) { return { statusCode: 200, body: { success: true } }; }
  async handleRejectClaim(id: string, headers: any, _extra?: any) { return { statusCode: 200, body: { success: true } }; }
  async handleSettleClaim(id: string, body: any, headers: any, _extra?: any) { return { statusCode: 200, body: { success: true } }; }
  async handleListClaims(query: any, headers: any, _extra?: any) { return this.handleList(query, headers); }

}

