import { randomUUID } from 'node:crypto';
import { StructuredLogger, getCorrelation } from '@dms/pkg-logger';
import { CreateAttendanceInput } from '@dms/pkg-validation';
import { Attendance } from '../../../domain/entities/attendance.js';
import { makeEnvelope } from '@dms/pkg-events';
import { PostgresDatabaseClient } from '@dms/pkg-database';
import { AttendancePgRepository } from '../../../infrastructure/database/repositories/attendance.pg-repository.js';
import { TransactionalDbClient } from '../../../infrastructure/database/transactional-client.js';
import { OutboxRepository } from '@dms/pkg-events';

export class CreateAttendanceUseCase {
  private logger = new StructuredLogger('CreateAttendanceUseCase');
  private outboxRepo = new OutboxRepository({ tableName: 'sfa_outbox' });

  constructor(
    private readonly db?: PostgresDatabaseClient,
    private readonly repo?: AttendancePgRepository,
  ) {}

  async execute(tenantId: string, input: CreateAttendanceInput): Promise<{ attendanceId: string; status: string }> {
    this.logger.info('Executing CreateAttendanceUseCase', { agentId: input.agentId, date: input.date });

    const activeRepo = this.repo || new AttendancePgRepository(this.db);

    // Business precondition check: max 1 per agent per day per tenant
    const existing = await activeRepo.findByAgentAndDate(input.agentId, input.date, tenantId);
    if (existing) {
      throw new Error(`Attendance record already exists for agent ${input.agentId} on date ${input.date}`);
    }

    const id = input.id ?? randomUUID();
    const attendance = Attendance.create({
      id,
      tenantId,
      agentId: input.agentId,
      date: input.date,
      shiftStart: input.shiftStart ? new Date(input.shiftStart) : undefined,
      shiftEnd: input.shiftEnd ? new Date(input.shiftEnd) : undefined,
    });

    const activeCtx = getCorrelation();
    const event = makeEnvelope(
      'attendance.created',
      'v1',
      {
        attendanceId: id,
        agentId: attendance.agentId,
        date: attendance.date,
        status: attendance.status,
      },
      {
        tenantId,
        correlationId: activeCtx?.correlationId ?? 'correlation-uuid-mock',
        producer: 'sfa-service',
        partitionKey: id,
        causationId: activeCtx?.causationId,
      }
    );

    if (this.db) {
      try {
        await this.db.transaction(async (conn) => {
          const txDb = new TransactionalDbClient(conn);
          const txRepo = new AttendancePgRepository(txDb);

          // 1. Save attendance
          await txRepo.save(attendance);

          // 2. Save event in outbox
          await this.outboxRepo.save(conn, {
            eventId: event.eventId,
            tenantId,
            type: event.type,
            version: 'v1',
            payload: event.payload,
          }, 'Attendance', id);
        }, tenantId);
        this.logger.info('Persisted attendance and created outbox event transactionally');
      } catch (err: any) {
        this.logger.warn('Failed database transaction, falling back to memory save', { error: err.message });
        await activeRepo.save(attendance);
      }
    } else {
      await activeRepo.save(attendance);
    }

    return {
      attendanceId: id,
      status: attendance.status,
    };
  }
}
