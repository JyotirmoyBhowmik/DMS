import { PlaceOrderUseCase } from '../../../application/usecases/place_order.usecase';
import { PlaceOrderSchema } from '@dms/pkg-validation';
import { StructuredLogger } from '@dms/pkg-logger';

export class OrderController {
  private useCase = new PlaceOrderUseCase();
  private logger = new StructuredLogger('OrderController');

  async handlePostOrder(requestBody: any, headers: Record<string, string>): Promise<any> {
    const tenantId = headers['x-tenant-id'] || 'mock-tenant';
    const agentId = headers['x-agent-id'] || 'mock-agent';

    this.logger.info('Received HTTP POST order request', { tenantId, agentId });

    const validationResult = PlaceOrderSchema.safeParse(requestBody);
    if (!validationResult.success) {
      this.logger.warn('Validation failed for placed order', { errors: validationResult.error.errors });
      return {
        statusCode: 400,
        body: {
          message: 'Bad Request',
          errors: validationResult.error.errors,
        },
      };
    }

    try {
      const result = await this.useCase.execute(tenantId, agentId, validationResult.data);
      return {
        statusCode: 201,
        body: {
          success: true,
          ...result,
        },
      };
    } catch (err: any) {
      this.logger.error('Order placement execution failed', { error: err.message });
      return {
        statusCode: 500,
        body: {
          message: 'Internal Server Error',
        },
      };
    }
  }
}
