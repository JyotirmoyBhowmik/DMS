import { CreateOrderApprovalUseCase } from '../../../application/usecases/order-approval/create_order_approval.usecase.js';
import { UpdateOrderApprovalUseCase } from '../../../application/usecases/order-approval/update_order_approval.usecase.js';
import { ListOrderApprovalsUseCase } from '../../../application/usecases/order-approval/list_order_approvals.usecase.js';
import { CreateOrderApprovalSchema, UpdateOrderApprovalSchema } from '@dms/pkg-validation';
import { StructuredLogger } from '@dms/pkg-logger';
import { loadConfigSync } from '@dms/pkg-config';
import { PostgresDatabaseClient, PgDriver } from '@dms/pkg-database';
import { OrderApprovalPgRepository } from '../../../infrastructure/database/repositories/order-approval.pg-repository.js';

const config = loadConfigSync();

export class OrderApprovalController {
  private db = new PostgresDatabaseClient(config.db, new PgDriver());
  private repo = new OrderApprovalPgRepository(this.db);
  private createUseCase = new CreateOrderApprovalUseCase(this.db, this.repo);
  private updateUseCase = new UpdateOrderApprovalUseCase(this.db, this.repo);
  private listUseCase = new ListOrderApprovalsUseCase(this.db, this.repo);
  private logger = new StructuredLogger('OrderApprovalController');

  async handlePostApproval(requestBody: any, headers: Record<string, string>): Promise<any> {
    const tenantId = headers['x-tenant-id'] || 'mock-tenant';
    const agentId = headers['x-agent-id'] || 'mock-agent';

    this.logger.info('Received HTTP POST order approval request', { tenantId, agentId });

    const validationResult = CreateOrderApprovalSchema.safeParse(requestBody);
    if (!validationResult.success) {
      this.logger.warn('Validation failed for create order approval', { errors: validationResult.error.errors });
      return {
        statusCode: 400,
        body: {
          message: 'Bad Request',
          errors: validationResult.error.errors,
        },
      };
    }

    try {
      const result = await this.createUseCase.execute(tenantId, agentId, validationResult.data);
      return {
        statusCode: 201,
        body: {
          success: true,
          approvalId: result.approvalId,
          status: result.status,
        },
      };
    } catch (err: any) {
      this.logger.error('Failed to create order approval', { error: err.message });
      return {
        statusCode: 500,
        body: {
          message: err.message || 'Internal Server Error',
        },
      };
    }
  }

  async handlePutApproval(id: string, requestBody: any, headers: Record<string, string>): Promise<any> {
    const tenantId = headers['x-tenant-id'] || 'mock-tenant';
    const agentId = headers['x-agent-id'] || 'mock-agent';

    this.logger.info('Received HTTP PUT order approval request', { id, tenantId, agentId });

    const validationResult = UpdateOrderApprovalSchema.safeParse(requestBody);
    if (!validationResult.success) {
      this.logger.warn('Validation failed for update order approval', { errors: validationResult.error.errors });
      return {
        statusCode: 400,
        body: {
          message: 'Bad Request',
          errors: validationResult.error.errors,
        },
      };
    }

    try {
      const result = await this.updateUseCase.execute(tenantId, agentId, id, validationResult.data);
      return {
        statusCode: 200,
        body: {
          success: true,
          approvalId: result.approvalId,
          status: result.status,
        },
      };
    } catch (err: any) {
      this.logger.error('Failed to update order approval', { error: err.message });
      return {
        statusCode: err.message.includes('not found') ? 404 : 500,
        body: {
          message: err.message || 'Internal Server Error',
        },
      };
    }
  }

  async handleGetApproval(id: string, headers: Record<string, string>): Promise<any> {
    const tenantId = headers['x-tenant-id'] || 'mock-tenant';
    this.logger.info('Received HTTP GET order approval request', { id, tenantId });

    try {
      const approval = await this.repo.findById(id, tenantId);
      if (!approval) {
        return {
          statusCode: 404,
          body: {
            message: `Order approval with ID ${id} not found`,
          },
        };
      }

      return {
        statusCode: 200,
        body: {
          success: true,
          approval: approval.toJSON(),
        },
      };
    } catch (err: any) {
      this.logger.error('Failed to get order approval', { error: err.message });
      return {
        statusCode: 500,
        body: {
          message: err.message || 'Internal Server Error',
        },
      };
    }
  }

  async handleListApprovals(requestBody: any, headers: Record<string, string>): Promise<any> {
    const tenantId = headers['x-tenant-id'] || 'mock-tenant';
    this.logger.info('Received HTTP GET order approvals list request', { tenantId });

    try {
      const result = await this.listUseCase.execute(tenantId, requestBody || {});
      return {
        statusCode: 200,
        body: {
          success: true,
          data: result.data.map(a => a.toJSON()),
          page: result.page,
          pageSize: result.pageSize,
        },
      };
    } catch (err: any) {
      this.logger.error('Failed to list order approvals', { error: err.message });
      return {
        statusCode: 500,
        body: {
          message: err.message || 'Internal Server Error',
        },
      };
    }
  }
}
