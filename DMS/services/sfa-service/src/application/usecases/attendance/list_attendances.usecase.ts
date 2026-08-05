import { StructuredLogger } from '@dms/pkg-logger';
import { Attendance } from '../../../domain/entities/attendance.js';
import { AttendancePgRepository } from '../../../infrastructure/database/repositories/attendance.pg-repository.js';
import { PostgresDatabaseClient } from '@dms/pkg-database';

export interface ListAttendancesQuery {
  page?: number;
  pageSize?: number;
  agentId?: string;
  date?: string;
  status?: string;
}

export class ListAttendancesUseCase {
  private logger = new StructuredLogger('ListAttendancesUseCase');

  constructor(
    private readonly db?: PostgresDatabaseClient,
    private readonly repo?: AttendancePgRepository,
  ) {}

  async execute(tenantId: string, query: ListAttendancesQuery): Promise<{ data: Attendance[]; page: number; pageSize: number }> {
    this.logger.info('Executing ListAttendancesUseCase', { query, tenantId });

    const activeRepo = this.repo || new AttendancePgRepository(this.db);
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 20)); // hard maximum cap 100

    let list = await activeRepo.findAll(tenantId);
    if (list.length === 0) {
      list = Array.from(AttendancePgRepository.inMemoryDb.values()) as Attendance[];
    }

    // Tenant bounds filtering
    list = list.filter(a => a.tenantId === tenantId);

    // Apply filters
    if (query.agentId) {
      list = list.filter(a => a.agentId === query.agentId);
    }
    if (query.date) {
      list = list.filter(a => a.date === query.date);
    }
    if (query.status) {
      list = list.filter(a => a.status === query.status!.toLowerCase());
    }

    // Keyset pagination slicing
    const startIndex = (page - 1) * pageSize;
    const paginated = list.slice(startIndex, startIndex + pageSize);

    return {
      data: paginated,
      page,
      pageSize,
    };
  }
}
