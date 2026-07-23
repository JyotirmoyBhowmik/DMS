/**
 * SchemeBudget Domain Entity.
 * Represents allocated financial budget for a scheme:
 * ACTIVE -> EXHAUSTED / FROZEN / CLOSED.
 */

export type SchemeBudgetStatus = 'ACTIVE' | 'EXHAUSTED' | 'FROZEN' | 'CLOSED';

export interface SchemeBudgetProps {
  id: string;
  tenantId: string;
  schemeId: string;
  name: string;
  budgetCode: string;
  totalAllocatedCents: number;
  utilizedCents?: number;
  status?: SchemeBudgetStatus;
  version?: number;
}

export class SchemeBudget {
  public readonly id: string;
  public readonly tenantId: string;
  public readonly schemeId: string;
  private _name: string;
  public readonly budgetCode: string;
  private _totalAllocatedCents: number;
  private _utilizedCents: number;
  private _status: SchemeBudgetStatus;
  private _version: number;

  public readonly domainEvents: Array<{ type: string; payload: any }> = [];

  constructor(props: SchemeBudgetProps) {
    if (!props.id || !props.tenantId || !props.schemeId || !props.name || !props.budgetCode) {
      throw new Error('SchemeBudget must have id, tenantId, schemeId, name, and budgetCode');
    }
    if (props.totalAllocatedCents < 0) {
      throw new Error('totalAllocatedCents must be non-negative');
    }
    const utilized = props.utilizedCents ?? 0;
    if (utilized < 0 || utilized > props.totalAllocatedCents) {
      throw new Error('utilizedCents must be between 0 and totalAllocatedCents');
    }

    this.id = props.id;
    this.tenantId = props.tenantId;
    this.schemeId = props.schemeId;
    this._name = props.name;
    this.budgetCode = props.budgetCode;
    this._totalAllocatedCents = props.totalAllocatedCents;
    this._utilizedCents = utilized;
    this._status = props.status ?? (utilized >= props.totalAllocatedCents ? 'EXHAUSTED' : 'ACTIVE');
    this._version = props.version ?? 1;
  }

  get name(): string { return this._name; }
  get totalAllocatedCents(): number { return this._totalAllocatedCents; }
  get utilizedCents(): number { return this._utilizedCents; }
  get remainingCents(): number { return this._totalAllocatedCents - this._utilizedCents; }
  get status(): SchemeBudgetStatus { return this._status; }
  get version(): number { return this._version; }

  static create(props: SchemeBudgetProps): SchemeBudget {
    const budget = new SchemeBudget(props);
    budget.domainEvents.push({
      type: 'schemes.scheme_budget.created',
      payload: {
        id: budget.id,
        schemeId: budget.schemeId,
        name: budget.name,
        budgetCode: budget.budgetCode,
        totalAllocatedCents: budget.totalAllocatedCents,
        utilizedCents: budget.utilizedCents,
        status: budget.status,
      },
    });
    return budget;
  }

  recordUtilization(amountCents: number): void {
    if (this._status === 'CLOSED' || this._status === 'FROZEN') {
      throw new Error(`Cannot record utilization when budget status is ${this._status}`);
    }
    if (amountCents <= 0) {
      throw new Error('Utilization amount must be positive');
    }
    if (this._utilizedCents + amountCents > this._totalAllocatedCents) {
      throw new Error('Utilization exceeds total allocated budget');
    }

    this._utilizedCents += amountCents;
    if (this._utilizedCents === this._totalAllocatedCents) {
      this._status = 'EXHAUSTED';
    }
    this._version++;

    this.domainEvents.push({
      type: 'schemes.scheme_budget.utilized',
      payload: {
        id: this.id,
        utilizedCents: this._utilizedCents,
        remainingCents: this.remainingCents,
        status: this._status,
        version: this._version,
      },
    });
  }

  updateStatus(newStatus: SchemeBudgetStatus): void {
    if (this._status === 'CLOSED') {
      throw new Error(`Cannot transition from final status CLOSED`);
    }

    this._status = newStatus;
    this._version++;

    this.domainEvents.push({
      type: 'schemes.scheme_budget.status_updated',
      payload: { id: this.id, status: this._status, version: this._version },
    });
  }

  toJSON() {
    return {
      id: this.id,
      tenantId: this.tenantId,
      schemeId: this.schemeId,
      name: this._name,
      budgetCode: this.budgetCode,
      totalAllocatedCents: this._totalAllocatedCents,
      utilizedCents: this._utilizedCents,
      remainingCents: this.remainingCents,
      status: this._status,
      version: this._version,
    };
  }
}
