import { CreateSchemeClaimUseCase } from '../../../application/usecases/create-scheme-claim.usecase.js';
import { GetSchemeClaimUseCase } from '../../../application/usecases/get-scheme-claim.usecase.js';
import { UpdateSchemeClaimUseCase } from '../../../application/usecases/update-scheme-claim.usecase.js';
import { ListSchemeClaimsUseCase } from '../../../application/usecases/list-scheme-claims.usecase.js';
import { SchemeClaimPgRepository } from '../../../infrastructure/database/repositories/scheme_claim.pg-repository.js';
import {
  CreateSchemeClaimSchema,
  UpdateSchemeClaimSchema,
  QuerySchemeClaimSchema,
} from '@dms/pkg-validation';
import { StructuredLogger } from '@dms/pkg-logger';

export interface Principal {
  userId: string;
  tenantId: string;
  roles: string[];
  permissions: string[];
}


export class SchemeClaimController {
  private logger = new StructuredLogger('SchemeClaimController');
  private createUseCase: CreateSchemeClaimUseCase;
  private getUseCase: GetSchemeClaimUseCase;
  private updateUseCase: UpdateSchemeClaimUseCase;
  private listUseCase: ListSchemeClaimsUseCase;

  constructor(repository = new SchemeClaimPgRepository()) {
    this.createUseCase = new CreateSchemeClaimUseCase(repository);
    this.getUseCase = new GetSchemeClaimUseCase(repository);
    this.updateUseCase = new UpdateSchemeClaimUseCase(repository);
    this.listUseCase = new ListSchemeClaimsUseCase(repository);
  }

  private buildPrincipal(headers: Record<string, string | undefined>): Principal {
    const tenantId = headers['x-tenant-id'] || '00000000-0000-0000-0000-000000000001';
    const userId = headers['x-user-id'] || 'system-user-id';
    const rolesHeader = headers['x-user-roles'] || 'admin';
    const roles = rolesHeader.split(',').map(r => r.trim());

    return {
      userId,
      tenantId,
      roles,
      permissions: [
        'scheme_claim:create',
        'scheme_claim:read',
        'scheme_claim:update',
        'scheme_claim:delete',
        'scheme_claim:approve',
      ],
    };
  }

  async handleCreate(body: any, headers: Record<string, string | undefined>, idempotencyKey?: string) {
    const principal = this.buildPrincipal(headers);
    try {
      const parsed = CreateSchemeClaimSchema.parse(body);
      const claim = await this.createUseCase.execute(principal, parsed, idempotencyKey);
      return {
        statusCode: 201,
        body: {
          success: true,
          claim: claim.toJSON(),
        },
      };
    } catch (err: any) {
      this.logger.error(`Create failed: ${err.message}`);
      const isForbidden = err.message.includes('Forbidden') || err.message.includes('Insufficient');
      const isConflict = err.message.includes('already exists');
      const statusCode = isForbidden ? 403 : isConflict ? 409 : 400;
      return { statusCode, body: { success: false, error: err.message } };
    }
  }

  async handleGet(id: string, headers: Record<string, string | undefined>) {
    const principal = this.buildPrincipal(headers);
    try {
      const claim = await this.getUseCase.execute(principal, id);
      return {
        statusCode: 200,
        body: {
          success: true,
          claim: claim.toJSON(),
        },
      };
    } catch (err: any) {
      const isNotFound = err.message.includes('not found');
      const isForbidden = err.message.includes('Forbidden') || err.message.includes('Insufficient');
      return {
        statusCode: isNotFound ? 404 : isForbidden ? 403 : 400,
        body: { success: false, error: err.message },
      };
    }
  }

  async handleUpdate(id: string, body: any, headers: Record<string, string | undefined>) {
    const principal = this.buildPrincipal(headers);
    try {
      const parsed = UpdateSchemeClaimSchema.parse(body);
      const claim = await this.updateUseCase.execute(principal, id, parsed);
      return {
        statusCode: 200,
        body: {
          success: true,
          claim: claim.toJSON(),
        },
      };
    } catch (err: any) {
      const isConflict = err.message.includes('Version conflict');
      const isNotFound = err.message.includes('not found');
      const isForbidden = err.message.includes('Forbidden') || err.message.includes('Insufficient');
      return {
        statusCode: isConflict ? 409 : isNotFound ? 404 : isForbidden ? 403 : 400,
        body: { success: false, error: err.message },
      };
    }
  }

  async handleList(query: any, headers: Record<string, string | undefined>) {
    const principal = this.buildPrincipal(headers);
    try {
      const parsed = QuerySchemeClaimSchema.parse(query);
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
      const isForbidden = err.message.includes('Forbidden') || err.message.includes('Insufficient');
      return { statusCode: isForbidden ? 403 : 400, body: { success: false, error: err.message } };
    }
  }
}
