import { StructuredLogger } from '@dms/pkg-logger';
import { OrderApproval } from '../../../domain/entities/order-approval.js';
import { OrderApprovalRepository } from '../../../domain/repositories/order-approval.repository.js';
import { OrderApprovalPgRepository } from '../../../infrastructure/database/repositories/order-approval.pg-repository.js';
import { PostgresDatabaseClient } from '@dms/pkg-database';

export interface ListOrderApprovalsQuery {
  page?: number;
  pageSize?: number;
  status?: string;
  approvalLevel?: number;
  orderId?: string;
  orderBy?: string;
  orderDirection?: 'ASC' | 'DESC';
}

export class ListOrderApprovalsUseCase {
  private logger = new StructuredLogger('ListOrderApprovalsUseCase');

  constructor(
    private readonly db?: PostgresDatabaseClient,
    private readonly repo?: OrderApprovalRepository,
  ) {}

  async execute(tenantId: string, query: ListOrderApprovalsQuery): Promise<{ data: OrderApproval[]; page: number; pageSize: number }> {
    this.logger.info('Executing ListOrderApprovalsUseCase', { query });

    const activeRepo = this.repo || new OrderApprovalPgRepository(this.db);

    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 20)); // Enforce hard max page size limit (100)

    // Retrieve all scoped approvals
    let approvals = await activeRepo.findAll(tenantId);

    // Filter rules
    if (query.status) {
      approvals = approvals.filter(a => a.status === query.status);
    }
    if (query.approvalLevel) {
      approvals = approvals.filter(a => a.approvalLevel === Number(query.approvalLevel));
    }
    if (query.orderId) {
      approvals = approvals.filter(a => a.orderId === query.orderId);
    }

    // Sort rules
    const sortField = query.orderBy ?? 'requestedAt';
    const direction = query.orderDirection === 'ASC' ? 1 : -1;
    approvals.sort((a: any, b: any) => {
      const valA = a[sortField] instanceof Date ? a[sortField].getTime() : a[sortField];
      const valB = b[sortField] instanceof Date ? b[sortField].getTime() : b[sortField];
      if (valA < valB) return -1 * direction;
      if (valA > valB) return 1 * direction;
      return 0;
    });

    // Keyset pagination slicing
    const startIndex = (page - 1) * pageSize;
    const paginatedApprovals = approvals.slice(startIndex, startIndex + pageSize);

    return {
      data: paginatedApprovals,
      page,
      pageSize,
    };
  }
}
