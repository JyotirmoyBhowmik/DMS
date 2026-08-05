import { Attendance } from '../entities/attendance';

/**
 * Repository port for Attendance aggregate persistence.
 */
export abstract class AttendanceRepository {
  abstract save(attendance: Attendance): Promise<Attendance>;
  abstract findById(id: string, tenantId: string): Promise<Attendance | null>;
  abstract findByAgentAndDate(agentId: string, date: string, tenantId: string): Promise<Attendance | null>;
  abstract findAll(tenantId: string): Promise<Attendance[]>;
  abstract findByAgent(agentId: string, tenantId: string): Promise<Attendance[]>;
  abstract delete(id: string, tenantId: string): Promise<void>;
}
