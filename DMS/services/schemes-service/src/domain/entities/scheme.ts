/**
 * Scheme Domain Entity.
 * Represents trade/promotional scheme rules:
 * DRAFT -> ACTIVE -> EXPIRED / SUSPENDED -> ARCHIVED.
 */

export type SchemeStatus = 'DRAFT' | 'ACTIVE' | 'EXPIRED' | 'SUSPENDED' | 'ARCHIVED';
export type SchemeType = 'QUANTITY_DISCOUNT' | 'VALUE_DISCOUNT' | 'BUY_X_GET_Y' | 'REBATE';

export interface SchemeProps {
  id: string;
  tenantId: string;
  name: string;
  code: string;
  schemeType?: SchemeType;
  description?: string;
  status?: SchemeStatus;
  version?: number;
}

export class Scheme {
  public readonly id: string;
  public readonly tenantId: string;
  private _name: string;
  public readonly code: string;
  public readonly schemeType: SchemeType;
  private _description: string;
  private _status: SchemeStatus;
  private _version: number;

  public readonly domainEvents: Array<{ type: string; payload: any }> = [];

  constructor(props: SchemeProps) {
    if (!props.id || !props.tenantId || !props.name || !props.code) {
      throw new Error('Scheme must have id, tenantId, name, and code');
    }

    this.id = props.id;
    this.tenantId = props.tenantId;
    this._name = props.name;
    this.code = props.code;
    this.schemeType = props.schemeType ?? 'QUANTITY_DISCOUNT';
    this._description = props.description ?? '';
    this._status = props.status ?? 'DRAFT';
    this._version = props.version ?? 1;
  }

  get name(): string { return this._name; }
  get description(): string { return this._description; }
  get status(): SchemeStatus { return this._status; }
  get version(): number { return this._version; }

  static create(props: SchemeProps): Scheme {
    const scheme = new Scheme(props);
    scheme.domainEvents.push({
      type: 'schemes.scheme.created',
      payload: {
        id: scheme.id,
        name: scheme.name,
        code: scheme.code,
        schemeType: scheme.schemeType,
        status: scheme.status,
      },
    });
    return scheme;
  }

  updateStatus(newStatus: SchemeStatus): void {
    if (this._status === 'ARCHIVED') {
      throw new Error(`Cannot transition from final status ARCHIVED`);
    }

    const validTransitions: Record<SchemeStatus, SchemeStatus[]> = {
      DRAFT: ['ACTIVE', 'ARCHIVED'],
      ACTIVE: ['EXPIRED', 'SUSPENDED', 'ARCHIVED'],
      EXPIRED: ['ACTIVE', 'ARCHIVED'],
      SUSPENDED: ['ACTIVE', 'ARCHIVED'],
      ARCHIVED: [],
    };

    const allowed = validTransitions[this._status];
    if (!allowed.includes(newStatus)) {
      throw new Error(`Illegal state transition from ${this._status} to ${newStatus}`);
    }

    this._status = newStatus;
    this._version++;

    this.domainEvents.push({
      type: 'schemes.scheme.status_updated',
      payload: { id: this.id, status: this._status, version: this._version },
    });
  }

  toJSON() {
    return {
      id: this.id,
      tenantId: this.tenantId,
      name: this._name,
      code: this.code,
      schemeType: this.schemeType,
      description: this._description,
      status: this._status,
      version: this._version,
    };
  }
}
