import { GeoPoint } from '../value-objects/geo-point';

/**
 * Visit domain entity.
 * Represents an agent's visit to a retail outlet, with check-in/check-out,
 * geo coordinates, and task tracking.
 */
export type VisitStatus = 'planned' | 'in_progress' | 'completed' | 'skipped';

export interface VisitTask {
  taskId: string;
  taskType: string;       // e.g. 'shelf_audit', 'stock_check', 'order_collection', 'merchandising'
  completedAt: Date;
  notes: string;
}

export interface VisitProps {
  id: string;
  tenantId: string;
  agentId: string;
  outletId: string;
  journeyPlanId: string;
  status: VisitStatus;
  checkInTime: Date | null;
  checkOutTime: Date | null;
  checkInLocation: GeoPoint | null;
  checkOutLocation: GeoPoint | null;
  tasksCompleted: VisitTask[];
  plannedDate: Date;
  version: number;
}

export class Visit {
  private props: VisitProps;

  private constructor(props: VisitProps) {
    this.props = { ...props, tasksCompleted: [...props.tasksCompleted] };
  }

  static create(input: {
    id: string;
    tenantId: string;
    agentId: string;
    outletId: string;
    journeyPlanId: string;
    plannedDate: Date;
  }): Visit {
    return new Visit({
      ...input,
      status: 'planned',
      checkInTime: null,
      checkOutTime: null,
      checkInLocation: null,
      checkOutLocation: null,
      tasksCompleted: [],
      version: 0,
    });
  }

  static reconstitute(props: VisitProps): Visit {
    return new Visit(props);
  }

  get id(): string { return this.props.id; }
  get tenantId(): string { return this.props.tenantId; }
  get agentId(): string { return this.props.agentId; }
  get outletId(): string { return this.props.outletId; }
  get journeyPlanId(): string { return this.props.journeyPlanId; }
  get status(): VisitStatus { return this.props.status; }
  get checkInTime(): Date | null { return this.props.checkInTime; }
  get checkOutTime(): Date | null { return this.props.checkOutTime; }
  get checkInLocation(): GeoPoint | null { return this.props.checkInLocation; }
  get checkOutLocation(): GeoPoint | null { return this.props.checkOutLocation; }
  get tasksCompleted(): ReadonlyArray<VisitTask> { return this.props.tasksCompleted; }
  get plannedDate(): Date { return this.props.plannedDate; }
  get version(): number { return this.props.version; }

  /** Mark check-in. Only valid from 'planned' state. */
  checkIn(location: GeoPoint): void {
    this.props.checkInTime = new Date();
    this.props.checkInLocation = location;
    this.props.status = 'in_progress';
  }

  /** Record a completed task during the visit. */
  recordTask(task: VisitTask): void {
    this.props.tasksCompleted.push(task);
  }

  /** Mark check-out and transition to 'completed'. */
  checkOut(location: GeoPoint): void {
    this.props.checkOutTime = new Date();
    this.props.checkOutLocation = location;
    this.props.status = 'completed';
  }

  /** Skip the visit entirely. */
  skip(): void {
    this.props.status = 'skipped';
  }

  /** Check whether a particular task type has been completed. */
  hasCompletedTask(taskType: string): boolean {
    return this.props.tasksCompleted.some((t) => t.taskType === taskType);
  }

  /** Duration of the visit in minutes. Returns null if not completed. */
  durationMinutes(): number | null {
    if (!this.props.checkInTime || !this.props.checkOutTime) return null;
    return Math.round(
      (this.props.checkOutTime.getTime() - this.props.checkInTime.getTime()) / 60_000,
    );
  }

  incrementVersion(): void {
    this.props.version += 1;
  }

  toJSON(): VisitProps {
    return {
      ...this.props,
      tasksCompleted: [...this.props.tasksCompleted],
      checkInLocation: this.props.checkInLocation,
      checkOutLocation: this.props.checkOutLocation,
    };
  }
}
