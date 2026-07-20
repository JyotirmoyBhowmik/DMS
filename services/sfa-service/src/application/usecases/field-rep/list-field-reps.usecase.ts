import { FieldRepRepository } from '../../../domain/repositories/field-rep.repository.js';
import { FieldRep } from '../../../domain/entities/field-rep.js';
import { RbacGuard, Principal } from '@dms/pkg-rbac';
import { PostgresDatabaseClient } from '@dms/pkg-database';
import { FieldRepPgRepository } from '../../../infrastructure/database/repositories/field-rep.pg-repository.js';

export interface ListFieldRepsDTO {
  tenantId: string;
  page?: number;
  pageSize?: number;
  status?: string;
  employeeCode?: string;
  search?: string;
}

export class ListFieldRepsUseCase {
  constructor(
    private readonly db?: PostgresDatabaseClient,
    private readonly repo?: FieldRepRepository
  ) {}

  async execute(principal: Principal, dto: ListFieldRepsDTO): Promise<{
    items: FieldRep[];
    total: number;
    page: number;
    pageSize: number;
  }> {
    if (!principal) {
      throw new Error('Forbidden: Authentication required');
    }
    if (principal.tenantId !== dto.tenantId) {
      throw new Error('Forbidden: Tenant context mismatch');
    }
    if (!RbacGuard.can(principal, 'field_rep:read') && !principal.roles.includes('admin')) {
      throw new Error('Forbidden: Insufficient permissions to view field representatives');
    }

    const activeRepo = this.repo || new FieldRepPgRepository(this.db);

    const page = Math.max(1, dto.page ?? 1);
    const rawPageSize = dto.pageSize ?? 20;
    const pageSize = Math.max(1, Math.min(100, rawPageSize));
    const offset = (page - 1) * pageSize;

    const filters = {
      status: dto.status,
      employeeCode: dto.employeeCode,
      search: dto.search,
    };

    const items = await activeRepo.findAll(dto.tenantId, pageSize, offset, filters);
    const total = await activeRepo.count(dto.tenantId, filters);

    return {
      items,
      total,
      page,
      pageSize,
    };
  }
}
