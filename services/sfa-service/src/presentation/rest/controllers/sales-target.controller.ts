import { CreateSalesTargetUseCase, UpdateSalesTargetProgressUseCase, GetAgentSalesTargetsUseCase } from '../../../application/usecases/sales-target/sales-target.usecases.js';
import { SalesTargetPgRepository } from '../../../infrastructure/database/repositories/sales-target.pg-repository.js';
import { PostgresDatabaseClient } from '@dms/pkg-database';
import { StructuredLogger } from '@dms/pkg-logger';

import { RequirePermissions } from '@dms/pkg-rbac';

export class SalesTargetController {
  private logger = new StructuredLogger('SalesTargetController');
  
  constructor(
    private readonly createUseCase: CreateSalesTargetUseCase,
    private readonly updateUseCase: UpdateSalesTargetProgressUseCase,
    private readonly getUseCase: GetAgentSalesTargetsUseCase
  ) {}

  @RequirePermissions('sales_target:create')

  async handleCreateTarget(body: any, headers: Record<string, string | undefined>) {
    const tenantId = headers['x-tenant-id'] || '00000000-0000-0000-0000-000000000001';
    this.logger.info('Create sales target', { tenantId, targetId: body.id });
    try {
      const target = await this.createUseCase.execute({ ...body, tenantId });
      return { statusCode: 201, body: { success: true, target: { id: target.id, targetAmount: target.targetAmount.amount, achievedAmount: target.achievedAmount.amount } } };
    } catch (err: any) {
      return { statusCode: 400, body: { success: false, error: err.message } };
    }
  }

  @RequirePermissions('sales_target:update')
  async handleUpdateProgress(body: any, headers: Record<string, string | undefined>) {
    const tenantId = headers['x-tenant-id'] || '00000000-0000-0000-0000-000000000001';
    this.logger.info('Update sales target progress', { tenantId, targetId: body.id });
    try {
      const target = await this.updateUseCase.execute({ ...body, tenantId });
      return { statusCode: 200, body: { success: true, target: { id: target.id, achievedAmount: target.achievedAmount.amount, progressPercentage: target.progressPercentage } } };
    } catch (err: any) {
      return { statusCode: 400, body: { success: false, error: err.message } };
    }
  }

  @RequirePermissions('sales_target:read')
  async handleGetAgentTargets(agentId: string, month: number, year: number, headers: Record<string, string | undefined>) {
    const tenantId = headers['x-tenant-id'] || '00000000-0000-0000-0000-000000000001';
    this.logger.info('Get agent sales targets', { tenantId, agentId, month, year });
    try {
      const targets = await this.getUseCase.execute(agentId, month, year, tenantId);
      return { statusCode: 200, body: { success: true, targets: targets.map(t => ({ id: t.id, targetAmount: t.targetAmount.amount, achievedAmount: t.achievedAmount.amount, progressPercentage: t.progressPercentage })) } };
    } catch (err: any) {
      return { statusCode: 400, body: { success: false, error: err.message } };
    }
  }
}
