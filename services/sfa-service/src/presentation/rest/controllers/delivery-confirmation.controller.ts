import { CreateDeliveryConfirmationUseCase, CreateDeliveryConfirmationDTO } from '../../../application/usecases/delivery-confirmation/create-delivery-confirmation.usecase';
import { StructuredLogger } from '@dms/pkg-logger';
import { RequirePermissions } from '@dms/pkg-rbac';

export class DeliveryConfirmationController {
  private logger = new StructuredLogger('DeliveryConfirmationController');

  constructor(private readonly createUseCase: CreateDeliveryConfirmationUseCase) {}

  @RequirePermissions('delivery_confirmation:create')
  async handleCreate(body: any, headers: Record<string, string | undefined>): Promise<{ statusCode: number; body: Record<string, unknown> }> {
    const tenantId = headers['x-tenant-id'] || '00000000-0000-0000-0000-000000000001';
    this.logger.info('Create delivery confirmation request received', { tenantId, orderId: body.orderId });
    
    try {
      const dto: CreateDeliveryConfirmationDTO = {
        ...body,
        tenantId,
      };
      
      const confirmation = await this.createUseCase.execute(dto);
      
      return {
        statusCode: 201,
        body: { success: true, confirmation: confirmation.toJSON() }
      };
    } catch (err: any) {
      return {
        statusCode: 400,
        body: { success: false, error: err.message }
      };
    }
  }
}
