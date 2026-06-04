/**
 * BeatRoute domain entity.
 * Defines a territory route with ordered outlet stops, assigned agents,
 * and frequency. Enforces max 30 outlets, no duplicates, contiguous sequences.
 */
export type BeatRouteStatus = 'draft' | 'active' | 'suspended' | 'archived';
export type BeatRouteFrequency = 'daily' | 'weekly' | 'monthly';

export interface BeatOutlet {
  outletId: string;
  sequence: number;
  lat: number;
  lng: number;
}

export interface BeatRouteProps {
  id: string;
  tenantId: string;
  name: string;
  region: string;
  assignedAgentIds: string[];
  outlets: BeatOutlet[];
  frequency: BeatRouteFrequency;
  status: BeatRouteStatus;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  version: number;
}

export class BeatRoute {
  private props: BeatRouteProps;

  private constructor(props: BeatRouteProps) {
    this.props = {
      ...props,
      assignedAgentIds: [...props.assignedAgentIds],
      outlets: props.outlets.map((o) => ({ ...o })),
    };
  }

  static create(input: {
    id: string;
    tenantId: string;
    name: string;
    region: string;
    assignedAgentIds?: string[];
    outlets?: BeatOutlet[];
    frequency?: BeatRouteFrequency;
  }): BeatRoute {
    const outlets = input.outlets ?? [];
    BeatRoute.validateOutlets(outlets);
    const now = new Date();
    return new BeatRoute({
      ...input,
      assignedAgentIds: input.assignedAgentIds ?? [],
      outlets: [...outlets].sort((a, b) => a.sequence - b.sequence),
      frequency: input.frequency ?? 'daily',
      status: 'draft',
      isActive: true,
      createdAt: now,
      updatedAt: now,
      version: 0,
    });
  }

  static reconstitute(props: BeatRouteProps): BeatRoute {
    return new BeatRoute(props);
  }

  // ── Accessors ──────────────────────────────────────────────────
  get id(): string { return this.props.id; }
  get tenantId(): string { return this.props.tenantId; }
  get name(): string { return this.props.name; }
  get region(): string { return this.props.region; }
  get assignedAgentIds(): ReadonlyArray<string> { return this.props.assignedAgentIds; }
  get outlets(): ReadonlyArray<BeatOutlet> { return this.props.outlets; }
  get frequency(): BeatRouteFrequency { return this.props.frequency; }
  get status(): BeatRouteStatus { return this.props.status; }
  get isActive(): boolean { return this.props.isActive; }
  get createdAt(): Date { return this.props.createdAt; }
  get updatedAt(): Date { return this.props.updatedAt; }
  get version(): number { return this.props.version; }

  // ── State Transitions ─────────────────────────────────────────
  activate(): void {
    if (this.props.status !== 'draft' && this.props.status !== 'suspended') {
      throw new Error(`Cannot activate beat route from state: ${this.props.status}`);
    }
    this.props.status = 'active';
    this.props.isActive = true;
    this.props.updatedAt = new Date();
  }

  suspend(): void {
    if (this.props.status !== 'active') {
      throw new Error(`Cannot suspend beat route from state: ${this.props.status}`);
    }
    this.props.status = 'suspended';
    this.props.isActive = false;
    this.props.updatedAt = new Date();
  }

  archive(): void {
    if (this.props.status !== 'suspended') {
      throw new Error(`Cannot archive beat route from state: ${this.props.status}`);
    }
    this.props.status = 'archived';
    this.props.isActive = false;
    this.props.updatedAt = new Date();
  }

  // ── Mutations ──────────────────────────────────────────────────
  assignAgent(agentId: string): void {
    if (!this.props.assignedAgentIds.includes(agentId)) {
      this.props.assignedAgentIds.push(agentId);
      this.props.updatedAt = new Date();
    }
  }

  removeAgent(agentId: string): void {
    this.props.assignedAgentIds = this.props.assignedAgentIds.filter((id) => id !== agentId);
    this.props.updatedAt = new Date();
  }

  addOutlet(outlet: BeatOutlet): void {
    if (this.props.outlets.length >= 30) {
      throw new Error('Beat route cannot have more than 30 outlets');
    }
    if (this.props.outlets.some((o) => o.outletId === outlet.outletId)) {
      throw new Error(`Outlet ${outlet.outletId} already exists in this beat route`);
    }
    this.props.outlets.push({ ...outlet });
    this.props.outlets.sort((a, b) => a.sequence - b.sequence);
    this.validateSequenceContiguity();
    this.props.updatedAt = new Date();
  }

  removeOutlet(outletId: string): void {
    this.props.outlets = this.props.outlets.filter((o) => o.outletId !== outletId);
    this.props.updatedAt = new Date();
  }

  updateName(name: string): void {
    this.props.name = name;
    this.props.updatedAt = new Date();
  }

  updateFrequency(frequency: BeatRouteFrequency): void {
    this.props.frequency = frequency;
    this.props.updatedAt = new Date();
  }

  incrementVersion(): void {
    this.props.version += 1;
  }

  // ── Validation ─────────────────────────────────────────────────
  private static validateOutlets(outlets: BeatOutlet[]): void {
    if (outlets.length > 30) {
      throw new Error('Beat route cannot have more than 30 outlets');
    }
    const ids = outlets.map((o) => o.outletId);
    if (new Set(ids).size !== ids.length) {
      throw new Error('Duplicate outlets are not allowed in a beat route');
    }
    if (outlets.length > 0) {
      const sorted = [...outlets].sort((a, b) => a.sequence - b.sequence);
      for (let i = 0; i < sorted.length; i++) {
        if (sorted[i].sequence !== i + 1) {
          throw new Error(`Outlet sequence must be contiguous starting from 1. Gap at position ${i + 1}`);
        }
      }
    }
  }

  private validateSequenceContiguity(): void {
    const sorted = [...this.props.outlets].sort((a, b) => a.sequence - b.sequence);
    for (let i = 0; i < sorted.length; i++) {
      if (sorted[i].sequence !== i + 1) {
        throw new Error(`Outlet sequence must be contiguous starting from 1. Gap at position ${i + 1}`);
      }
    }
  }

  toJSON(): Record<string, unknown> {
    return {
      id: this.props.id,
      tenantId: this.props.tenantId,
      name: this.props.name,
      region: this.props.region,
      assignedAgentIds: [...this.props.assignedAgentIds],
      outlets: this.props.outlets.map((o) => ({ ...o })),
      frequency: this.props.frequency,
      status: this.props.status,
      isActive: this.props.isActive,
      createdAt: this.props.createdAt.toISOString(),
      updatedAt: this.props.updatedAt.toISOString(),
      version: this.props.version,
    };
  }
}
