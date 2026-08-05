import { CreatePaymentUseCase } from '../../../application/usecases/create-payment.usecase.js';
import { GetPaymentUseCase } from '../../../application/usecases/get-payment.usecase.js';
import { UpdatePaymentUseCase } from '../../../application/usecases/update-payment.usecase.js';
import { ListPaymentsUseCase } from '../../../application/usecases/list-payments.usecase.js';
import { PaymentPgRepository } from '../../../infrastructure/database/repositories/payment.pg-repository.js';
import { Principal } from '../../../application/usecases/create-invoice.usecase.js';
import { StructuredLogger } from '@dms/pkg-logger';

export class PaymentController {
  private logger = new StructuredLogger('PaymentController');
  private createUseCase: CreatePaymentUseCase;
  private getUseCase: GetPaymentUseCase;
  private updateUseCase: UpdatePaymentUseCase;
  private listUseCase: ListPaymentsUseCase;

  constructor(repository = new PaymentPgRepository()) {
    this.createUseCase = new CreatePaymentUseCase(repository);
    this.getUseCase = new GetPaymentUseCase(repository);
    this.updateUseCase = new UpdatePaymentUseCase(repository);
    this.listUseCase = new ListPaymentsUseCase(repository);
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
        'finance:payment:create',
        'finance:payment:read',
        'finance:payment:update',
        'finance:payment:list',
        'finance:payment:approve',
      ],
    };
  }

  async handleCreate(body: any, headers: Record<string, string | undefined>, idempotencyKey?: string) {
    const principal = this.buildPrincipal(headers);
    const correlationId = headers['x-correlation-id'] || `corr-${Date.now()}`;

    try {
      if (headers['content-type'] && !headers['content-type'].includes('application/json')) {
        return { statusCode: 415, body: { success: false, error: 'Unsupported Content-Type. Must be application/json', correlationId } };
      }

      const payment = await this.createUseCase.execute(principal, body, idempotencyKey, correlationId);
      return {
        statusCode: 201,
        body: {
          success: true,
          payment: payment.toJSON(),
          correlationId,
        },
      };
    } catch (err: any) {
      this.logger.error(`Create payment failed: ${err.message}`, { correlationId });
      const isForbidden = err.message.includes('Forbidden') || err.message.includes('Insufficient');
      const isConflict = err.message.includes('already exists');
      const statusCode = isForbidden ? 403 : isConflict ? 409 : 400;

      return {
        statusCode,
        body: {
          success: false,
          error: err.message,
          fields: err.fields || undefined,
          correlationId,
        },
      };
    }
  }

  async handleGet(id: string, headers: Record<string, string | undefined>) {
    const principal = this.buildPrincipal(headers);
    const correlationId = headers['x-correlation-id'] || `corr-${Date.now()}`;

    try {
      const payment = await this.getUseCase.execute(principal, id);
      return {
        statusCode: 200,
        body: {
          success: true,
          payment: payment.toJSON(),
          correlationId,
        },
      };
    } catch (err: any) {
      const isNotFound = err.message.includes('not found');
      const isForbidden = err.message.includes('Forbidden');
      return {
        statusCode: isNotFound ? 404 : isForbidden ? 403 : 400,
        body: { success: false, error: err.message, correlationId },
      };
    }
  }

  async handleUpdate(id: string, body: any, headers: Record<string, string | undefined>) {
    const principal = this.buildPrincipal(headers);
    const correlationId = headers['x-correlation-id'] || `corr-${Date.now()}`;

    try {
      const payment = await this.updateUseCase.execute(principal, id, body, correlationId);
      return {
        statusCode: 200,
        body: {
          success: true,
          payment: payment.toJSON(),
          correlationId,
        },
      };
    } catch (err: any) {
      const isConflict = err.message.includes('Version conflict');
      const isNotFound = err.message.includes('not found');
      const isForbidden = err.message.includes('Forbidden');
      return {
        statusCode: isConflict ? 409 : isNotFound ? 404 : isForbidden ? 403 : 400,
        body: { success: false, error: err.message, correlationId },
      };
    }
  }

  async handleList(query: any, headers: Record<string, string | undefined>) {
    const principal = this.buildPrincipal(headers);
    const correlationId = headers['x-correlation-id'] || `corr-${Date.now()}`;

    try {
      const result = await this.listUseCase.execute(principal, query);
      return {
        statusCode: 200,
        body: {
          success: true,
          ...result,
          data: result.data.map(p => p.toJSON()),
          correlationId,
        },
      };
    } catch (err: any) {
      const isForbidden = err.message.includes('Forbidden');
      return {
        statusCode: isForbidden ? 403 : 400,
        body: { success: false, error: err.message, correlationId },
      };
    }
  }
}
