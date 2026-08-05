import { CreateInvoiceUseCase, Principal } from '../../../application/usecases/create-invoice.usecase.js';
import { GetInvoiceUseCase } from '../../../application/usecases/get-invoice.usecase.js';
import { UpdateInvoiceUseCase } from '../../../application/usecases/update-invoice.usecase.js';
import { ListInvoicesUseCase } from '../../../application/usecases/list-invoices.usecase.js';
import { InvoicePgRepository } from '../../../infrastructure/database/repositories/invoice.pg-repository.js';
import { StructuredLogger } from '@dms/pkg-logger';

export class InvoiceController {
  private logger = new StructuredLogger('InvoiceController');
  private createUseCase: CreateInvoiceUseCase;
  private getUseCase: GetInvoiceUseCase;
  private updateUseCase: UpdateInvoiceUseCase;
  private listUseCase: ListInvoicesUseCase;

  constructor(repository = new InvoicePgRepository()) {
    this.createUseCase = new CreateInvoiceUseCase(repository);
    this.getUseCase = new GetInvoiceUseCase(repository);
    this.updateUseCase = new UpdateInvoiceUseCase(repository);
    this.listUseCase = new ListInvoicesUseCase(repository);
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
        'finance:invoice:create',
        'finance:invoice:read',
        'finance:invoice:update',
        'finance:invoice:list',
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

      const invoice = await this.createUseCase.execute(principal, body, idempotencyKey);
      return {
        statusCode: 201,
        body: {
          success: true,
          invoice: invoice.toJSON(),
          correlationId,
        },
      };
    } catch (err: any) {
      this.logger.error(`Create invoice failed: ${err.message}`, { correlationId });
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
      const invoice = await this.getUseCase.execute(principal, id);
      return {
        statusCode: 200,
        body: {
          success: true,
          invoice: invoice.toJSON(),
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
      const invoice = await this.updateUseCase.execute(principal, id, body);
      return {
        statusCode: 200,
        body: {
          success: true,
          invoice: invoice.toJSON(),
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
          data: result.data.map(i => i.toJSON()),
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
