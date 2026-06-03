import { PlaceOrderUseCase } from '../../../application/usecases/place_order.usecase.js';
import { ProcessOrderUseCase } from '../../../application/usecases/process_order.usecase.js';
import { OrderEntity } from '../../../domain/entities/order.entity.js';
import { PlaceOrderSchema } from '@dms/pkg-validation';
import { StructuredLogger } from '@dms/pkg-logger';

export class OrderController {
  private placeUseCase = new PlaceOrderUseCase();
  private processUseCase = new ProcessOrderUseCase();
  private logger = new StructuredLogger('OrderController');

  // In-memory db for order aggregate entities
  private static ordersDb = new Map<string, OrderEntity>();

  static clearStore() {
    this.ordersDb.clear();
  }

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
      // 1. Place basic order
      const placeResult = await this.placeUseCase.execute(tenantId, agentId, validationResult.data);
      
      // 2. Reconstruct OrderEntity to process volume breaks and GST tax
      const entity = new OrderEntity({
        id: placeResult.orderId,
        tenantId,
        outletId: validationResult.data.outletId,
        items: validationResult.data.items,
        notes: validationResult.data.notes,
        status: 'draft',
      });

      // 3. Process, compute schemes/GST, and confirm
      const processResult = await this.processUseCase.execute(entity);

      // Save confirmed entity to store
      OrderController.ordersDb.set(placeResult.orderId, entity);

      return {
        statusCode: 201,
        body: {
          success: true,
          orderId: placeResult.orderId,
          status: processResult.status,
          netTotal: processResult.netTotal,
          taxAmount: processResult.taxAmount,
          discountAmount: processResult.discountAmount,
        },
      };
    } catch (err: any) {
      this.logger.error('Order placement execution failed', { error: err.message });
      return {
        statusCode: 500,
        body: {
          message: err.message || 'Internal Server Error',
        },
      };
    }
  }

  async handleCancelOrder(orderId: string, headers: Record<string, string>): Promise<any> {
    const tenantId = headers['x-tenant-id'] || 'mock-tenant';
    this.logger.info('Received HTTP POST order cancel request', { orderId, tenantId });

    const order = OrderController.ordersDb.get(orderId);
    if (!order) {
      return {
        statusCode: 404,
        body: { error: 'Order not found' },
      };
    }

    if (order.status === 'confirmed') {
      // Allow cancellation for testing, but let's update state mapping
      order.status = 'cancelled';
      this.logger.info('Order successfully cancelled', { orderId });
      return {
        statusCode: 200,
        body: { success: true, status: order.status },
      };
    }

    return {
      statusCode: 400,
      body: { error: 'Cannot cancel order in this state' },
    };
  }
}
