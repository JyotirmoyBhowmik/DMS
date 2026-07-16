import { BasePostgresRepository, BaseRow, PostgresDatabaseClient, PgDriver } from '@dms/pkg-database';
import { Attendance, AttendanceStatus } from '../../../domain/entities/attendance.js';
import { AttendanceRepository } from '../../../domain/repositories/attendance.repository.js';
import { GeoPoint } from '../../../domain/value-objects/geo-point.js';
import { StructuredLogger } from '@dms/pkg-logger';
import { loadConfigSync } from '@dms/pkg-config';

const config = loadConfigSync();

class PgAttendanceRepo extends BasePostgresRepository<Attendance> {
  async checkHealth() {
    return await this.db.checkHealth();
  }

  async query<T = unknown>(sql: string, params?: unknown[], tenantId?: string) {
    return await this.db.query<T>(sql, params, tenantId);
  }

  override tableName(): string {
    return 'attendance';
  }

  public override mapToEntity(row: BaseRow): Attendance {
    const checkInLocation = (row.check_in_lat != null && row.check_in_lng != null)
      ? GeoPoint.create(Number(row.check_in_lat), Number(row.check_in_lng))
      : null;

    const checkOutLocation = (row.check_out_lat != null && row.check_out_lng != null)
      ? GeoPoint.create(Number(row.check_out_lat), Number(row.check_out_lng))
      : null;

    // Convert date object/string/number safely
    let dateStr = '';
    if (row.date instanceof Date) {
      dateStr = row.date.toISOString().slice(0, 10);
    } else if (typeof row.date === 'string') {
      dateStr = row.date.slice(0, 10);
    } else {
      dateStr = new Date().toISOString().slice(0, 10);
    }

    return Attendance.reconstitute({
      id: row.id,
      tenantId: row.tenant_id,
      agentId: row.agent_id as string,
      date: dateStr,
      shiftStart: row.shift_start ? new Date(row.shift_start as any) : null,
      shiftEnd: row.shift_end ? new Date(row.shift_end as any) : null,
      checkInTime: row.check_in_time ? new Date(row.check_in_time as any) : null,
      checkOutTime: row.check_out_time ? new Date(row.check_out_time as any) : null,
      checkInLocation,
      checkOutLocation,
      status: (row.status as string || 'absent') as AttendanceStatus,
      leaveType: row.leave_type as string | null,
      totalHoursWorked: Number(row.total_hours_worked || 0),
      overtimeHours: Number(row.overtime_hours || 0),
      createdAt: row.created_at ? new Date(row.created_at as any) : new Date(),
      updatedAt: row.updated_at ? new Date(row.updated_at as any) : new Date(),
      version: row.version || 0,
    });
  }

  protected mapToRow(entity: Attendance): BaseRow {
    return {
      id: entity.id,
      tenant_id: entity.tenantId,
      agent_id: entity.agentId,
      date: entity.date,
      shift_start: entity.shiftStart,
      shift_end: entity.shiftEnd,
      check_in_time: entity.checkInTime,
      check_out_time: entity.checkOutTime,
      check_in_lat: entity.checkInLocation ? entity.checkInLocation.latitude : null,
      check_in_lng: entity.checkInLocation ? entity.checkInLocation.longitude : null,
      check_out_lat: entity.checkOutLocation ? entity.checkOutLocation.latitude : null,
      check_out_lng: entity.checkOutLocation ? entity.checkOutLocation.longitude : null,
      status: entity.status,
      leave_type: entity.leaveType,
      total_hours_worked: entity.totalHoursWorked,
      overtime_hours: entity.overtimeHours,
      version: entity.version,
      created_at: entity.createdAt,
      updated_at: entity.updatedAt,
    };
  }
}

export class AttendancePgRepository implements AttendanceRepository {
  private logger = new StructuredLogger('AttendancePgRepository');
  public static inMemoryDb: Map<string, Attendance> = new Map();
  private pgRepo: PgAttendanceRepo;
  private hasDb = false;

  constructor(db?: PostgresDatabaseClient) {
    const activeDb = db ?? new PostgresDatabaseClient(config.db, new PgDriver());
    this.pgRepo = new PgAttendanceRepo(activeDb);
    this.checkConnection().then(alive => {
      this.hasDb = alive;
    });
  }

  public static clearStore(): void {
    AttendancePgRepository.inMemoryDb.clear();
  }

  private async checkConnection(): Promise<boolean> {
    try {
      const res = await this.pgRepo.checkHealth();
      return res.status === 'HEALTHY';
    } catch {
      return false;
    }
  }

  async save(attendance: Attendance): Promise<Attendance> {
    if (this.hasDb) {
      try {
        this.logger.info('Saving attendance record to Postgres', { id: attendance.id, tenantId: attendance.tenantId });
        return await this.pgRepo.save(attendance, attendance.tenantId);
      } catch (err: any) {
        this.logger.warn('Failed to save to Postgres, falling back to memory', { error: err.message });
      }
    }
    AttendancePgRepository.inMemoryDb.set(attendance.id, attendance);
    return attendance;
  }

  async findById(id: string, tenantId: string): Promise<Attendance | null> {
    if (this.hasDb) {
      try {
        this.logger.info('Querying attendance by ID from Postgres', { id, tenantId });
        return await this.pgRepo.findById(id, tenantId);
      } catch (err: any) {
        this.logger.warn('Failed to fetch from Postgres, falling back to memory', { error: err.message });
      }
    }
    const match = AttendancePgRepository.inMemoryDb.get(id);
    if (match && match.tenantId === tenantId) {
      return match;
    }
    return null;
  }

  async findByAgentAndDate(agentId: string, date: string, tenantId: string): Promise<Attendance | null> {
    if (this.hasDb) {
      try {
        this.logger.info('Querying attendance by agent and date from Postgres', { agentId, date, tenantId });
        const sql = `SELECT * FROM "attendance" WHERE "agent_id" = $1 AND "date" = $2 AND "tenant_id" = $3 LIMIT 1`;
        const res = await this.pgRepo.query<BaseRow>(sql, [agentId, date, tenantId], tenantId);
        if (res.rows.length > 0) {
          return this.pgRepo.mapToEntity(res.rows[0]!);
        }
        return null;
      } catch (err: any) {
        this.logger.warn('Failed to query by agent and date from Postgres, falling back to memory', { error: err.message });
      }
    }
    const match = Array.from(AttendancePgRepository.inMemoryDb.values()).find(
      a => a.agentId === agentId && a.date === date && a.tenantId === tenantId
    );
    return match || null;
  }

  async findByAgent(agentId: string, tenantId: string): Promise<Attendance[]> {
    if (this.hasDb) {
      try {
        this.logger.info('Querying attendance by agent from Postgres', { agentId, tenantId });
        const sql = `SELECT * FROM "attendance" WHERE "agent_id" = $1 AND "tenant_id" = $2`;
        const res = await this.pgRepo.query<BaseRow>(sql, [agentId, tenantId], tenantId);
        return res.rows.map(row => this.pgRepo.mapToEntity(row));
      } catch (err: any) {
        this.logger.warn('Failed to query by agent from Postgres, falling back to memory', { error: err.message });
      }
    }
    return Array.from(AttendancePgRepository.inMemoryDb.values()).filter(
      a => a.agentId === agentId && a.tenantId === tenantId
    );
  }

  async findAll(tenantId: string): Promise<Attendance[]> {
    if (this.hasDb) {
      try {
        const res = await this.pgRepo.findAll(tenantId, { pageSize: 500 });
        return res.data;
      } catch (err: any) {
        this.logger.warn('Failed to findAll in Postgres, falling back to memory', { error: err.message });
      }
    }
    return Array.from(AttendancePgRepository.inMemoryDb.values()).filter(a => a.tenantId === tenantId);
  }

  async delete(id: string, tenantId: string): Promise<void> {
    if (this.hasDb) {
      try {
        await this.pgRepo.delete(id, tenantId);
        return;
      } catch (err: any) {
        this.logger.warn('Failed to delete from Postgres, falling back to memory', { error: err.message });
      }
    }
    AttendancePgRepository.inMemoryDb.delete(id);
  }
}
