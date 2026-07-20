import { PhotoCaptureRepository } from '../../../domain/repositories/photo-capture.repository.js';
import { PhotoCapture } from '../../../domain/entities/photo-capture.js';
import { RbacGuard, Principal } from '@dms/pkg-rbac';
import { PostgresDatabaseClient } from '@dms/pkg-database';
import { PhotoCapturePgRepository } from '../../../infrastructure/database/repositories/photo-capture.pg-repository.js';

export class GetPhotoCaptureUseCase {
  constructor(
    private readonly db?: PostgresDatabaseClient,
    private readonly repo?: PhotoCaptureRepository
  ) {}

  async execute(principal: Principal, id: string, tenantId: string): Promise<PhotoCapture> {
    if (!principal) {
      throw new Error('Forbidden: Authentication required');
    }
    if (principal.tenantId !== tenantId) {
      throw new Error('Forbidden: Tenant context mismatch');
    }
    if (!RbacGuard.can(principal, 'photo_capture:read')) {
      throw new Error('Forbidden: Insufficient permissions');
    }

    const activeRepo = this.repo || new PhotoCapturePgRepository(this.db);
    const capture = await activeRepo.findById(id, tenantId);

    if (!capture || capture.tenantId !== tenantId) {
      throw new Error(`PhotoCapture with ID ${id} not found`);
    }

    return capture;
  }
}
