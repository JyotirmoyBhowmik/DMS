import { CreateSettlementUseCase } from '../../../application/usecases/create-settlement.usecase.js';
import { GetSettlementUseCase } from '../../../application/usecases/get-settlement.usecase.js';
import { UpdateSettlementUseCase } from '../../../application/usecases/update-settlement.usecase.js';
import { ListSettlementsUseCase } from '../../../application/usecases/list-settlements.usecase.js';
import { SettlementPgRepository } from '../../../infrastructure/database/repositories/settlement.pg-repository.js';
import {
  CreateSettlementSchema,
  UpdateSettlementSchema,
  QuerySettlementSchema,
} from '@dms/pkg-validation';
import { StructuredLogger } from '@dms/pkg-logger';

export interface Principal {
  userId: string;
  tenantId: string;
  roles: string[];
  permissions: string[];
}

export class SettlementController {
  private logger = new StructuredLogger('SettlementController');
  private createUseCase: CreateSettlementUseCase;
  private getUseCase: GetSettlementUseCase;
  private updateUseCase: UpdateSettlementUseCase;
  private listUseCase: ListSettlementsUseCase;

  constructor(repository = new SettlementPgRepository()) {
    this.createUseCase = new CreateSettlementUseCase(repository);
    this.getUseCase = new GetSettlementUseCase(repository);
    this.updateUseCase = new UpdateSettlementUseCase(repository);
    this.listUseCase = new ListSettlementsUseCase(repository);
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
        'settlement:create',
        'settlement:read',
        'settlement:update',
        'settlement:delete',
        'settlement:approve',
      ],
    };
  }

  async handleCreate(body: any, headers: Record<string, string | undefined>, idempotencyKey?: string) {
    const principal = this.buildPrincipal(headers);
    try {
      const parsed = CreateSettlementSchema.parse(body);
      const settlement = await this.createUseCase.execute(principal, parsed, idempotencyKey);
      return {
        statusCode: 201,
        body: {
          success: true,
          settlement: settlement.toJSON(),
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
      const settlement = await this.getUseCase.execute(principal, id);
      return {
        statusCode: 200,
        body: {
          success: true,
          settlement: settlement.toJSON(),
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
      const parsed = UpdateSettlementSchema.parse(body);
      const settlement = await this.updateUseCase.execute(principal, id, parsed);
      return {
        statusCode: 200,
        body: {
          success: true,
          settlement: settlement.toJSON(),
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
      const parsed = QuerySettlementSchema.parse(query);
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
