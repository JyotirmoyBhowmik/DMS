import { CreateDeliveryConfirmationUseCase } from '../../../application/usecases/delivery-confirmation/create-delivery-confirmation.usecase.js';
import { GetDeliveryConfirmationUseCase } from '../../../application/usecases/delivery-confirmation/get-delivery-confirmation.usecase.js';
import { UpdateDeliveryConfirmationUseCase } from '../../../application/usecases/delivery-confirmation/update-delivery-confirmation.usecase.js';
import { ListDeliveryConfirmationsUseCase } from '../../../application/usecases/delivery-confirmation/list-delivery-confirmations.usecase.js';
import { DeliveryConfirmationPgRepository } from '../../../infrastructure/database/repositories/delivery-confirmation.pg-repository.js';
import { CreateDeliveryConfirmationSchema, UpdateDeliveryConfirmationSchema, ListDeliveryConfirmationsQuerySchema } from '@dms/pkg-validation';
import { PostgresDatabaseClient, PgDriver } from '@dms/pkg-database';
import { StructuredLogger } from '@dms/pkg-logger';
import { loadConfigSync } from '@dms/pkg-config';
import { RbacGuard, Principal } from '@dms/pkg-rbac';
import { recordAudit } from '../../../infrastructure/audit/audit-helper.js';

const config = loadConfigSync();

export class DeliveryConfirmationController {
  private db = new PostgresDatabaseClient(config.db, new PgDriver());
  private repo = new DeliveryConfirmationPgRepository(this.db);
  private createUseCase = new CreateDeliveryConfirmationUseCase(this.db, this.repo);
  private getUseCase = new GetDeliveryConfirmationUseCase(this.db, this.repo);
  private updateUseCase = new UpdateDeliveryConfirmationUseCase(this.db, this.repo);
  private listUseCase = new ListDeliveryConfirmationsUseCase(this.db, this.repo);
  private logger = new StructuredLogger('DeliveryConfirmationController');

  static clearStore(): void {
    DeliveryConfirmationPgRepository.clearStore();
  }

  private getPrincipal(headers: Record<string, string>): Principal {
    return {
      id: headers['x-user-id'] || 'mock-user-uuid',
      tenantId: headers['x-tenant-id'] || 'mock-tenant-uuid',
      roles: headers['x-user-roles'] ? headers['x-user-roles'].split(',') : ['agent'],
    };
  }

  async handleCreate(body: any, headers: Record<string, string>): Promise<{ statusCode: number; body: Record<string, unknown> }> {
    const tenantId = headers['x-tenant-id'] || '00000000-0000-0000-0000-000000000001';
    const principal = this.getPrincipal(headers);
    this.logger.info('Create delivery confirmation request received', { tenantId, orderId: body.orderId });
    
    const validationResult = CreateDeliveryConfirmationSchema.safeParse(body);
    if (!validationResult.success) {
      this.logger.warn('Validation failed for create delivery confirmation', { errors: validationResult.error.errors });
      return {
        statusCode: 400,
        body: { success: false, message: 'Bad Request', errors: validationResult.error.errors }
      };
    }

    try {
      const confirmation = await this.createUseCase.execute(principal, {
        ...validationResult.data,
        tenantId,
      });
      
      return {
        statusCode: 201,
        body: { success: true, confirmation: confirmation.toJSON() }
      };
    } catch (err: any) {
      this.logger.error('Failed to create delivery confirmation', { error: err.message });
      const status = err.message.includes('Forbidden') ? 403 : 400;
      return {
        statusCode: status,
        body: { success: false, error: err.message }
      };
    }
  }

  async handleGetDeliveryConfirmation(id: string, headers: Record<string, string>): Promise<any> {
    const tenantId = headers['x-tenant-id'] || '00000000-0000-0000-0000-000000000001';
    const principal = this.getPrincipal(headers);
    this.logger.info('Get delivery confirmation request received', { id, tenantId });

    try {
      const confirmation = await this.getUseCase.execute(principal, id, tenantId);
      return {
        statusCode: 200,
        body: { success: true, confirmation: confirmation.toJSON() }
      };
    } catch (err: any) {
      this.logger.error('Failed to get delivery confirmation', { error: err.message });
      const status = err.message.includes('Forbidden') ? 403 : (err.message.includes('not found') ? 404 : 500);
      return {
        statusCode: status,
        body: { success: false, error: err.message }
      };
    }
  }

  async handlePutDeliveryConfirmation(id: string, body: any, headers: Record<string, string>): Promise<any> {
    const tenantId = headers['x-tenant-id'] || '00000000-0000-0000-0000-000000000001';
    const principal = this.getPrincipal(headers);
    this.logger.info('Update delivery confirmation request received', { id, tenantId });

    const validationResult = UpdateDeliveryConfirmationSchema.safeParse(body);
    if (!validationResult.success) {
      this.logger.warn('Validation failed for update delivery confirmation', { errors: validationResult.error.errors });
      return {
        statusCode: 400,
        body: { success: false, message: 'Bad Request', errors: validationResult.error.errors }
      };
    }

    try {
      const confirmation = await this.updateUseCase.execute(principal, id, tenantId, validationResult.data);
      return {
        statusCode: 200,
        body: { success: true, confirmation: confirmation.toJSON() }
      };
    } catch (err: any) {
      this.logger.error('Failed to update delivery confirmation', { error: err.message });
      if (err.message.includes('Optimistic locking conflict') || err.message.includes('version mismatch')) {
        return {
          statusCode: 409,
          body: { success: false, message: err.message }
        };
      }
      const status = err.message.includes('Forbidden') ? 403 : (err.message.includes('not found') ? 404 : 500);
      return {
        statusCode: status,
        body: { success: false, error: err.message }
      };
    }
  }

  async handleListDeliveryConfirmations(query: any, headers: Record<string, string>): Promise<any> {
    const tenantId = headers['x-tenant-id'] || '00000000-0000-0000-0000-000000000001';
    const principal = this.getPrincipal(headers);
    this.logger.info('List delivery confirmations request received', { tenantId });

    const validationResult = ListDeliveryConfirmationsQuerySchema.safeParse(query);
    if (!validationResult.success) {
      return {
        statusCode: 400,
        body: { success: false, message: 'Bad Request', errors: validationResult.error.errors }
      };
    }

    try {
      const result = await this.listUseCase.execute(principal, tenantId, validationResult.data);
      return {
        statusCode: 200,
        body: {
          success: true,
          data: result.data.map(c => c.toJSON()),
          page: result.page,
          pageSize: result.pageSize,
          total: result.total,
        }
      };
    } catch (err: any) {
      this.logger.error('Failed to list delivery confirmations', { error: err.message });
      const status = err.message.includes('Forbidden') ? 403 : 500;
      return {
        statusCode: status,
        body: { success: false, error: err.message }
      };
    }
  }

  async handleDeleteDeliveryConfirmation(id: string, headers: Record<string, string>): Promise<any> {
    const tenantId = headers['x-tenant-id'] || '00000000-0000-0000-0000-000000000001';
    const principal = this.getPrincipal(headers);
    this.logger.info('Delete delivery confirmation request received', { id, tenantId });

    if (!RbacGuard.can(principal, 'delivery_confirmation:delete')) {
      return {
        statusCode: 403,
        body: { success: false, message: 'Forbidden: Insufficient permissions' }
      };
    }

    try {
      await this.repo.delete(id, tenantId);

      // Log deletion audit
      await recordAudit(
        principal.id,
        tenantId,
        'delivery_confirmation.deleted',
        `Delivery confirmation ${id} deleted`,
        {
          before: { id },
          after: null,
        }
      );

      return {
        statusCode: 200,
        body: { success: true }
      };
    } catch (err: any) {
      this.logger.error('Failed to delete delivery confirmation', { error: err.message });
      return {
        statusCode: 500,
        body: { success: false, error: err.message }
      };
    }
  }
}
