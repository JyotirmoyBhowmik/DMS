import { CompetitorCaptureRepository } from '../../../domain/repositories/competitor-capture.repository.js';
import { CompetitorCapture } from '../../../domain/entities/competitor-capture.js';
import { RbacGuard, Principal } from '@dms/pkg-rbac';
import { PostgresDatabaseClient } from '@dms/pkg-database';
import { CompetitorCapturePgRepository } from '../../../infrastructure/database/repositories/competitor-capture.pg-repository.js';

export class GetCompetitorCaptureUseCase {
  constructor(
    private readonly db?: PostgresDatabaseClient,
    private readonly repo?: CompetitorCaptureRepository
  ) {}

  async execute(principal: Principal, id: string, tenantId: string): Promise<CompetitorCapture> {
    if (!principal) {
      throw new Error('Forbidden: Authentication required');
    }
    if (principal.tenantId !== tenantId) {
      throw new Error('Forbidden: Tenant context mismatch');
    }
    if (!RbacGuard.can(principal, 'competitor_capture:read')) {
      throw new Error('Forbidden: Insufficient permissions');
    }

    const activeRepo = this.repo || new CompetitorCapturePgRepository(this.db);
    const capture = await activeRepo.findById(id, tenantId);

    if (!capture || capture.tenantId !== tenantId) {
      throw new Error(`CompetitorCapture with ID ${id} not found`);
    }

    return capture;
  }
}
