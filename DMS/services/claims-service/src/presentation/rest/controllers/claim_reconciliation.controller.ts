import { CreateClaimReconciliationUseCase } from '../../../application/usecases/create-claim-reconciliation.usecase.js';
import { GetClaimReconciliationUseCase } from '../../../application/usecases/get-claim-reconciliation.usecase.js';
import { UpdateClaimReconciliationUseCase } from '../../../application/usecases/update-claim-reconciliation.usecase.js';
import { ListClaimReconciliationsUseCase } from '../../../application/usecases/list-claim-reconciliations.usecase.js';
import { ClaimReconciliationPgRepository } from '../../../infrastructure/database/repositories/claim_reconciliation.pg-repository.js';
import {
  CreateClaimReconciliationSchema,
  UpdateClaimReconciliationSchema,
  QueryClaimReconciliationSchema,
} from '@dms/pkg-validation';
import { StructuredLogger } from '@dms/pkg-logger';

export interface Principal {
  userId: string;
  tenantId: string;
  roles: string[];
  permissions: string[];
}

export class ClaimReconciliationController {
  private logger = new StructuredLogger('ClaimReconciliationController');
  private createUseCase: CreateClaimReconciliationUseCase;
  private getUseCase: GetClaimReconciliationUseCase;
  private updateUseCase: UpdateClaimReconciliationUseCase;
  private listUseCase: ListClaimReconciliationsUseCase;

  constructor(repository = new ClaimReconciliationPgRepository()) {
    this.createUseCase = new CreateClaimReconciliationUseCase(repository);
    this.getUseCase = new GetClaimReconciliationUseCase(repository);
    this.updateUseCase = new UpdateClaimReconciliationUseCase(repository);
    this.listUseCase = new ListClaimReconciliationsUseCase(repository);
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
        'claim_reconciliation:create',
        'claim_reconciliation:read',
        'claim_reconciliation:update',
        'claim_reconciliation:delete',
        'claim_reconciliation:approve',
      ],
    };
  }

  async handleCreate(body: any, headers: Record<string, string | undefined>, idempotencyKey?: string) {
    const principal = this.buildPrincipal(headers);
    try {
      const parsed = CreateClaimReconciliationSchema.parse(body);
      const reconciliation = await this.createUseCase.execute(principal, parsed, idempotencyKey);
      return {
        statusCode: 201,
        body: {
          success: true,
          reconciliation: reconciliation.toJSON(),
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
      const reconciliation = await this.getUseCase.execute(principal, id);
      return {
        statusCode: 200,
        body: {
          success: true,
          reconciliation: reconciliation.toJSON(),
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
      const parsed = UpdateClaimReconciliationSchema.parse(body);
      const reconciliation = await this.updateUseCase.execute(principal, id, parsed);
      return {
        statusCode: 200,
        body: {
          success: true,
          reconciliation: reconciliation.toJSON(),
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
      const parsed = QueryClaimReconciliationSchema.parse(query);
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
