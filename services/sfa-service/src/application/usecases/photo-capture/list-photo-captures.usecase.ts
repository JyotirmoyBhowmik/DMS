import { PhotoCaptureRepository } from '../../../domain/repositories/photo-capture.repository.js';
import { PhotoCapture } from '../../../domain/entities/photo-capture.js';
import { RbacGuard, Principal } from '@dms/pkg-rbac';
import { PostgresDatabaseClient } from '@dms/pkg-database';
import { PhotoCapturePgRepository } from '../../../infrastructure/database/repositories/photo-capture.pg-repository.js';

export interface ListPhotoCapturesQuery {
  page?: number;
  pageSize?: number;
  agentId?: string;
  outletId?: string;
  status?: string;
  tag?: string;
}

export class ListPhotoCapturesUseCase {
  constructor(
    private readonly db?: PostgresDatabaseClient,
    private readonly repo?: PhotoCaptureRepository
  ) {}

  async execute(
    principal: Principal,
    tenantId: string,
    query: ListPhotoCapturesQuery
  ): Promise<{ items: PhotoCapture[]; total: number; page: number; pageSize: number }> {
    if (!principal) {
      throw new Error('Forbidden: Authentication required');
    }
    if (principal.tenantId !== tenantId) {
      throw new Error('Forbidden: Tenant context mismatch');
    }
    if (!RbacGuard.can(principal, 'photo_capture:read') && !RbacGuard.can(principal, 'photo-captures:read')) {
      throw new Error('Forbidden: Insufficient permissions');
    }

    const activeRepo = this.repo || new PhotoCapturePgRepository(this.db);

    const page = Math.max(1, query.page || 1);
    const rawPageSize = query.pageSize || 10;
    const pageSize = Math.min(100, Math.max(1, rawPageSize)); // Mandatory pagination cap

    const offset = (page - 1) * pageSize;

    // Filter logic
    let captures = await activeRepo.findAll(tenantId, 1000, 0);

    if (query.agentId) {
      captures = captures.filter((c) => c.agentId === query.agentId);
    }
    if (query.outletId) {
      captures = captures.filter((c) => c.outletId === query.outletId);
    }
    if (query.status) {
      captures = captures.filter((c) => c.status === query.status);
    }
    if (query.tag) {
      captures = captures.filter((c) => c.tags.includes(query.tag!));
    }

    const total = captures.length;
    const pagedItems = captures.slice(offset, offset + pageSize);

    return {
      items: pagedItems,
      total,
      page,
      pageSize,
    };
  }
}
