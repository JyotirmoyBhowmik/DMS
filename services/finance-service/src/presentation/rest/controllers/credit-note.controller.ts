import { CreateCreditNoteUseCase } from '../../../application/usecases/create-credit-note.usecase.js';
import { GetCreditNoteUseCase } from '../../../application/usecases/get-credit-note.usecase.js';
import { UpdateCreditNoteUseCase } from '../../../application/usecases/update-credit-note.usecase.js';
import { ListCreditNotesUseCase } from '../../../application/usecases/list-credit-notes.usecase.js';
import { CreditNotePgRepository } from '../../../infrastructure/database/repositories/credit-note.pg-repository.js';
import { Principal } from '../../../application/usecases/create-invoice.usecase.js';
import { StructuredLogger } from '@dms/pkg-logger';

export class CreditNoteController {
  private logger = new StructuredLogger('CreditNoteController');
  private createUseCase: CreateCreditNoteUseCase;
  private getUseCase: GetCreditNoteUseCase;
  private updateUseCase: UpdateCreditNoteUseCase;
  private listUseCase: ListCreditNotesUseCase;

  constructor(repository = new CreditNotePgRepository()) {
    this.createUseCase = new CreateCreditNoteUseCase(repository);
    this.getUseCase = new GetCreditNoteUseCase(repository);
    this.updateUseCase = new UpdateCreditNoteUseCase(repository);
    this.listUseCase = new ListCreditNotesUseCase(repository);
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
        'finance:credit_note:create',
        'finance:credit_note:read',
        'finance:credit_note:update',
        'finance:credit_note:list',
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

      const creditNote = await this.createUseCase.execute(principal, body, idempotencyKey);
      return {
        statusCode: 201,
        body: {
          success: true,
          creditNote: creditNote.toJSON(),
          correlationId,
        },
      };
    } catch (err: any) {
      this.logger.error(`Create credit note failed: ${err.message}`, { correlationId });
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
      const creditNote = await this.getUseCase.execute(principal, id);
      return {
        statusCode: 200,
        body: {
          success: true,
          creditNote: creditNote.toJSON(),
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
      const creditNote = await this.updateUseCase.execute(principal, id, body);
      return {
        statusCode: 200,
        body: {
          success: true,
          creditNote: creditNote.toJSON(),
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
          data: result.data.map(c => c.toJSON()),
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
