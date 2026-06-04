import { GeoPoint } from '../value-objects/geo-point';

/**
 * Attendance domain entity.
 * Tracks daily agent attendance with check-in/out, geolocation, and overtime.
 * Business rules: max 1 per agent per day, overtime after 8h, no future check-ins.
 */
export type AttendanceStatus = 'absent' | 'checked_in' | 'checked_out' | 'approved';

export interface AttendanceProps {
  id: string;
  tenantId: string;
  agentId: string;
  date: string; // ISO date YYYY-MM-DD
  shiftStart: Date | null;
  shiftEnd: Date | null;
  checkInTime: Date | null;
  checkOutTime: Date | null;
  checkInLocation: GeoPoint | null;
  checkOutLocation: GeoPoint | null;
  status: AttendanceStatus;
  leaveType: string | null;
  totalHoursWorked: number;
  overtimeHours: number;
  createdAt: Date;
  updatedAt: Date;
  version: number;
}

export class Attendance {
  private props: AttendanceProps;

  private constructor(props: AttendanceProps) {
    this.props = { ...props };
  }

  static create(input: {
    id: string;
    tenantId: string;
    agentId: string;
    date: string;
    shiftStart?: Date;
    shiftEnd?: Date;
  }): Attendance {
    const now = new Date();
    return new Attendance({
      ...input,
      shiftStart: input.shiftStart ?? null,
      shiftEnd: input.shiftEnd ?? null,
      checkInTime: null,
      checkOutTime: null,
      checkInLocation: null,
      checkOutLocation: null,
      status: 'absent',
      leaveType: null,
      totalHoursWorked: 0,
      overtimeHours: 0,
      createdAt: now,
      updatedAt: now,
      version: 0,
    });
  }

  static reconstitute(props: AttendanceProps): Attendance {
    return new Attendance(props);
  }

  // ── Accessors ──────────────────────────────────────────────────
  get id(): string { return this.props.id; }
  get tenantId(): string { return this.props.tenantId; }
  get agentId(): string { return this.props.agentId; }
  get date(): string { return this.props.date; }
  get shiftStart(): Date | null { return this.props.shiftStart; }
  get shiftEnd(): Date | null { return this.props.shiftEnd; }
  get checkInTime(): Date | null { return this.props.checkInTime; }
  get checkOutTime(): Date | null { return this.props.checkOutTime; }
  get checkInLocation(): GeoPoint | null { return this.props.checkInLocation; }
  get checkOutLocation(): GeoPoint | null { return this.props.checkOutLocation; }
  get status(): AttendanceStatus { return this.props.status; }
  get leaveType(): string | null { return this.props.leaveType; }
  get totalHoursWorked(): number { return this.props.totalHoursWorked; }
  get overtimeHours(): number { return this.props.overtimeHours; }
  get createdAt(): Date { return this.props.createdAt; }
  get updatedAt(): Date { return this.props.updatedAt; }
  get version(): number { return this.props.version; }

  // ── State Transitions ─────────────────────────────────────────
  checkIn(location: GeoPoint): void {
    if (this.props.status !== 'absent') {
      throw new Error(`Cannot check in from state: ${this.props.status}`);
    }
    const now = new Date();
    // Business rule: no future check-ins
    const todayStr = now.toISOString().slice(0, 10);
    if (this.props.date > todayStr) {
      throw new Error('Cannot check in for a future date');
    }
    this.props.checkInTime = now;
    this.props.checkInLocation = location;
    this.props.status = 'checked_in';
    this.props.updatedAt = now;
  }

  checkOut(location: GeoPoint): void {
    if (this.props.status !== 'checked_in') {
      throw new Error(`Cannot check out from state: ${this.props.status}`);
    }
    const now = new Date();
    this.props.checkOutTime = now;
    this.props.checkOutLocation = location;
    this.props.status = 'checked_out';
    this.computeHoursWorked();
    this.props.updatedAt = now;
  }

  approve(): void {
    if (this.props.status !== 'checked_out') {
      throw new Error(`Cannot approve attendance from state: ${this.props.status}`);
    }
    this.props.status = 'approved';
    this.props.updatedAt = new Date();
  }

  setLeaveType(leaveType: string): void {
    this.props.leaveType = leaveType;
    this.props.updatedAt = new Date();
  }

  incrementVersion(): void {
    this.props.version += 1;
  }

  // ── Internal ───────────────────────────────────────────────────
  private computeHoursWorked(): void {
    if (!this.props.checkInTime || !this.props.checkOutTime) return;
    const diffMs = this.props.checkOutTime.getTime() - this.props.checkInTime.getTime();
    const hours = Math.round((diffMs / 3_600_000) * 100) / 100;
    this.props.totalHoursWorked = hours;
    // Business rule: overtime after 8 hours
    this.props.overtimeHours = hours > 8 ? Math.round((hours - 8) * 100) / 100 : 0;
  }

  toJSON(): Record<string, unknown> {
    return {
      id: this.props.id,
      tenantId: this.props.tenantId,
      agentId: this.props.agentId,
      date: this.props.date,
      shiftStart: this.props.shiftStart?.toISOString() ?? null,
      shiftEnd: this.props.shiftEnd?.toISOString() ?? null,
      checkInTime: this.props.checkInTime?.toISOString() ?? null,
      checkOutTime: this.props.checkOutTime?.toISOString() ?? null,
      checkInLocation: this.props.checkInLocation?.toJSON() ?? null,
      checkOutLocation: this.props.checkOutLocation?.toJSON() ?? null,
      status: this.props.status,
      leaveType: this.props.leaveType,
      totalHoursWorked: this.props.totalHoursWorked,
      overtimeHours: this.props.overtimeHours,
      createdAt: this.props.createdAt.toISOString(),
      updatedAt: this.props.updatedAt.toISOString(),
      version: this.props.version,
    };
  }
}
