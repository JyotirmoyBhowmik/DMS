/**
 * Agent domain entity.
 * Represents a field sales agent operating within a tenant's region.
 * Private constructor + static factory enforces invariants on creation.
 */
export interface AgentProps {
  id: string;
  name: string;
  tenantId: string;
  region: string;
  status: 'active' | 'inactive';
}

export class Agent {
  private props: AgentProps;

  private constructor(props: AgentProps) {
    this.props = { ...props };
  }

  static create(input: Omit<AgentProps, 'status'>): Agent {
    if (!input.id || input.id.trim().length === 0) {
      throw new Error('Agent id is required');
    }
    if (!input.name || input.name.trim().length === 0) {
      throw new Error('Agent name is required');
    }
    if (!input.tenantId || input.tenantId.trim().length === 0) {
      throw new Error('Agent tenantId is required');
    }
    if (!input.region || input.region.trim().length === 0) {
      throw new Error('Agent region is required');
    }
    return new Agent({ ...input, status: 'active' });
  }

  /** Reconstitute from persistence without re-validating creation rules. */
  static reconstitute(props: AgentProps): Agent {
    return new Agent(props);
  }

  get id(): string {
    return this.props.id;
  }

  get name(): string {
    return this.props.name;
  }

  get tenantId(): string {
    return this.props.tenantId;
  }

  get region(): string {
    return this.props.region;
  }

  get status(): 'active' | 'inactive' {
    return this.props.status;
  }

  get isActive(): boolean {
    return this.props.status === 'active';
  }

  activate(): void {
    this.props.status = 'active';
  }

  deactivate(): void {
    this.props.status = 'inactive';
  }

  toJSON(): AgentProps {
    return { ...this.props };
  }
}
