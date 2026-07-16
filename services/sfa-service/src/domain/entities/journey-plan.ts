/**
 * JourneyPlan domain entity.
 * Defines a salesperson's planned route for a given day, including
 * ordered outlet stops and beat (territory) information.
 */
export interface PlannedOutlet {
  outletId: string;
  outletName: string;
  sequence: number;
  latitude: number;
  longitude: number;
  estimatedArrival: Date;
  visited: boolean;
}

export interface JourneyPlanProps {
  id: string;
  tenantId: string;
  agentId: string;
  date: string;            // ISO date string (YYYY-MM-DD)
  beatId: string;
  beatName: string;
  plannedOutlets: PlannedOutlet[];
  status: 'planned' | 'in_progress' | 'completed';
  actualStartTime: Date | null;
  actualEndTime: Date | null;
  version: number;
}

export class JourneyPlan {
  private props: JourneyPlanProps;

  private constructor(props: JourneyPlanProps) {
    this.props = {
      ...props,
      plannedOutlets: props.plannedOutlets.map((o) => ({ ...o })),
    };
  }

  static create(input: {
    id: string;
    tenantId: string;
    agentId: string;
    date: string;
    beatId: string;
    beatName: string;
    plannedOutlets: PlannedOutlet[];
  }): JourneyPlan {
    const sorted = [...input.plannedOutlets].sort((a, b) => a.sequence - b.sequence);
    return new JourneyPlan({
      ...input,
      plannedOutlets: sorted,
      status: 'planned',
      actualStartTime: null,
      actualEndTime: null,
      version: 0,
    });
  }

  static reconstitute(props: JourneyPlanProps): JourneyPlan {
    return new JourneyPlan(props);
  }

  get id(): string { return this.props.id; }
  get tenantId(): string { return this.props.tenantId; }
  get agentId(): string { return this.props.agentId; }
  get date(): string { return this.props.date; }
  get beatId(): string { return this.props.beatId; }
  get beatName(): string { return this.props.beatName; }
  get plannedOutlets(): ReadonlyArray<PlannedOutlet> { return this.props.plannedOutlets; }
  get status(): string { return this.props.status; }
  get actualStartTime(): Date | null { return this.props.actualStartTime; }
  get actualEndTime(): Date | null { return this.props.actualEndTime; }
  get version(): number { return this.props.version; }

  /** Start the journey. */
  startJourney(): void {
    if (this.props.status !== 'planned') {
      throw new Error(`Cannot start journey from state: ${this.props.status}`);
    }
    this.props.status = 'in_progress';
    this.props.actualStartTime = new Date();
  }

  /** Mark an outlet as visited. */
  markOutletVisited(outletId: string): void {
    if (this.props.status !== 'in_progress') {
      throw new Error(`Cannot record visits unless journey plan is in_progress (current state: ${this.props.status})`);
    }
    const outlet = this.props.plannedOutlets.find((o) => o.outletId === outletId);
    if (!outlet) {
      throw new Error(`Outlet stop with ID ${outletId} not found in this journey plan`);
    }
    outlet.visited = true;
  }

  /** Complete the journey. */
  completeJourney(): void {
    if (this.props.status !== 'in_progress') {
      throw new Error(`Cannot complete journey unless it is in_progress (current state: ${this.props.status})`);
    }
    this.props.status = 'completed';
    this.props.actualEndTime = new Date();
  }

  /** Add an ad-hoc outlet stop. */
  addOutlet(outlet: PlannedOutlet): void {
    if (this.props.status === 'completed') {
      throw new Error('Cannot add outlets to a completed journey plan');
    }
    this.props.plannedOutlets.push(outlet);
    this.props.plannedOutlets.sort((a, b) => a.sequence - b.sequence);
  }

  /** Remove an outlet from the plan. */
  removeOutlet(outletId: string): void {
    if (this.props.status === 'completed') {
      throw new Error('Cannot remove outlets from a completed journey plan');
    }
    this.props.plannedOutlets = this.props.plannedOutlets.filter(
      (o) => o.outletId !== outletId,
    );
  }

  /** Number of outlets visited vs total planned. */
  completionRate(): number {
    const total = this.props.plannedOutlets.length;
    if (total === 0) return 0;
    const visited = this.props.plannedOutlets.filter((o) => o.visited).length;
    return Math.round((visited / total) * 10000) / 100;
  }

  /** Get outlets that haven't been visited yet. */
  pendingOutlets(): PlannedOutlet[] {
    return this.props.plannedOutlets.filter((o) => !o.visited);
  }

  incrementVersion(): void {
    this.props.version += 1;
  }

  toJSON(): JourneyPlanProps {
    return {
      ...this.props,
      plannedOutlets: this.props.plannedOutlets.map((o) => ({ ...o })),
    };
  }
}
