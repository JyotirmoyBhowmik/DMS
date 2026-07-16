import { StructuredLogger } from '@dms/pkg-logger';
import { Attendance } from '../../../domain/entities/attendance.js';
import { AttendancePgRepository } from '../../../infrastructure/database/repositories/attendance.pg-repository.js';
import { PostgresDatabaseClient } from '@dms/pkg-database';

export class GetAttendanceUseCase {
  private logger = new StructuredLogger('GetAttendanceUseCase');

  constructor(
    private readonly db?: PostgresDatabaseClient,
    private readonly repo?: AttendancePgRepository,
  ) {}

  async execute(tenantId: string, id: string): Promise<Attendance> {
    this.logger.info('Executing GetAttendanceUseCase', { id, tenantId });

    const activeRepo = this.repo || new AttendancePgRepository(this.db);
    const attendance = await activeRepo.findById(id, tenantId);

    if (!attendance) {
      this.logger.warn('Attendance record not found', { id, tenantId });
      throw new Error(`Attendance with ID ${id} not found`);
    }

    return attendance;
  }
}
