import { CreateDebitNoteUseCase } from '../../../application/usecases/create-debit-note.usecase.js';
import { GetDebitNoteUseCase } from '../../../application/usecases/get-debit-note.usecase.js';
import { UpdateDebitNoteUseCase } from '../../../application/usecases/update-debit-note.usecase.js';
import { ListDebitNotesUseCase } from '../../../application/usecases/list-debit-notes.usecase.js';
import { DebitNotePgRepository } from '../../../infrastructure/database/repositories/debit-note.pg-repository.js';
import { Principal } from '../../../application/usecases/create-invoice.usecase.js';
import { StructuredLogger } from '@dms/pkg-logger';

export class DebitNoteController {
  private logger = new StructuredLogger('DebitNoteController');
  private createUseCase: CreateDebitNoteUseCase;
  private getUseCase: GetDebitNoteUseCase;
  private updateUseCase: UpdateDebitNoteUseCase;
  private listUseCase: ListDebitNotesUseCase;

  constructor(repository = new DebitNotePgRepository()) {
    this.createUseCase = new CreateDebitNoteUseCase(repository);
    this.getUseCase = new GetDebitNoteUseCase(repository);
    this.updateUseCase = new UpdateDebitNoteUseCase(repository);
    this.listUseCase = new ListDebitNotesUseCase(repository);
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
        'finance:debit_note:create',
        'finance:debit_note:read',
        'finance:debit_note:update',
        'finance:debit_note:list',
        'finance:debit_note:approve',
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

      const debitNote = await this.createUseCase.execute(principal, body, idempotencyKey, correlationId);
      return {
        statusCode: 201,
        body: {
          success: true,
          debitNote: debitNote.toJSON(),
          correlationId,
        },
      };
    } catch (err: any) {
      this.logger.error(`Create debit note failed: ${err.message}`, { correlationId });
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
      const debitNote = await this.getUseCase.execute(principal, id);
      return {
        statusCode: 200,
        body: {
          success: true,
          debitNote: debitNote.toJSON(),
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
      const debitNote = await this.updateUseCase.execute(principal, id, body, correlationId);
      return {
        statusCode: 200,
        body: {
          success: true,
          debitNote: debitNote.toJSON(),
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
          data: result.data.map(d => d.toJSON()),
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
