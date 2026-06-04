import { CreateCompetitorCaptureUseCase, CreateCompetitorCaptureDTO } from '../../../application/usecases/competitor-capture/create-competitor-capture.usecase';
import { StructuredLogger } from '@dms/pkg-logger';
import { RequirePermissions } from '@dms/pkg-rbac';

export class CompetitorCaptureController {
  private logger = new StructuredLogger('CompetitorCaptureController');

  constructor(private readonly createUseCase: CreateCompetitorCaptureUseCase) {}

  @RequirePermissions('competitor_capture:create')
  async handleCreate(body: any, headers: Record<string, string | undefined>): Promise<{ statusCode: number; body: Record<string, unknown> }> {
    const tenantId = headers['x-tenant-id'] || '00000000-0000-0000-0000-000000000001';
    this.logger.info('Create competitor capture request received', { tenantId, outletId: body.outletId });
    
    try {
      const dto: CreateCompetitorCaptureDTO = {
        ...body,
        tenantId,
      };
      
      const capture = await this.createUseCase.execute(dto);
      
      return {
        statusCode: 201,
        body: { success: true, capture: capture.toJSON() }
      };
    } catch (err: any) {
      return {
        statusCode: 400,
        body: { success: false, error: err.message }
      };
    }
  }
}
