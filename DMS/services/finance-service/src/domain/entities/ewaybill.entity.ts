import { randomUUID } from 'node:crypto';
import { DomainEvent } from './credit-note.entity.js';

export class EWayBillDomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EWayBillDomainError';
  }
}

export class InvalidEWayBillStateTransitionError extends EWayBillDomainError {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidEWayBillStateTransitionError';
  }
}

export class EWayBillValidationError extends EWayBillDomainError {
  constructor(public readonly fields: Record<string, string>, message = 'eWayBill validation failed') {
    const detail = Object.values(fields).join('; ');
    super(detail ? `${message}: ${detail}` : message);
    this.name = 'EWayBillValidationError';
  }
}

export type EWayBillStatus = 'GENERATED' | 'ACTIVE' | 'CANCELLED' | 'EXPIRED';

export interface EWayBillProps {
  id?: string;
  tenantId: string;
  invoiceId: string;
  ewayBillNumber: string;
  validUntil?: Date;
  vehicleNumber?: string;
  transporterId?: string;
  distanceKm?: number;
  status?: EWayBillStatus;
  idempotencyKey?: string;
  version?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export class EWayBill {
  private readonly _id: string;
  private readonly _tenantId: string;
  private readonly _invoiceId: string;
  private readonly _ewayBillNumber: string;
  private readonly _validUntil?: Date;
  private readonly _vehicleNumber?: string;
  private readonly _transporterId?: string;
  private readonly _distanceKm: number;
  private _status: EWayBillStatus;
  private readonly _idempotencyKey?: string;
  private _version: number;
  private readonly _createdAt: Date;
  private _updatedAt: Date;
  private _domainEvents: DomainEvent[] = [];

  constructor(props: EWayBillProps) {
    if (!props.tenantId) throw new EWayBillDomainError('tenantId is required');
    if (!props.invoiceId) throw new EWayBillDomainError('invoiceId is required');
    if (!props.ewayBillNumber || props.ewayBillNumber.trim().length === 0) {
      throw new EWayBillDomainError('ewayBillNumber is required');
    }

    const dist = props.distanceKm ?? 0;
    if (dist < 0) throw new EWayBillDomainError('distanceKm must be >= 0');

    this._id = props.id || randomUUID();
    this._tenantId = props.tenantId;
    this._invoiceId = props.invoiceId;
    this._ewayBillNumber = props.ewayBillNumber;
    this._validUntil = props.validUntil;
    this._vehicleNumber = props.vehicleNumber;
    this._transporterId = props.transporterId;
    this._distanceKm = dist;
    this._status = props.status || 'GENERATED';
    this._idempotencyKey = props.idempotencyKey;
    this._version = props.version || 1;
    this._createdAt = props.createdAt || new Date();
    this._updatedAt = props.updatedAt || new Date();
  }

  get id(): string { return this._id; }
  get tenantId(): string { return this._tenantId; }
  get invoiceId(): string { return this._invoiceId; }
  get ewayBillNumber(): string { return this._ewayBillNumber; }
  get validUntil(): Date | undefined { return this._validUntil; }
  get vehicleNumber(): string | undefined { return this._vehicleNumber; }
  get transporterId(): string | undefined { return this._transporterId; }
  get distanceKm(): number { return this._distanceKm; }
  get status(): EWayBillStatus { return this._status; }
  get idempotencyKey(): string | undefined { return this._idempotencyKey; }
  get version(): number { return this._version; }
  get createdAt(): Date { return this._createdAt; }
  get updatedAt(): Date { return this._updatedAt; }
  get domainEvents(): DomainEvent[] { return [...this._domainEvents]; }

  public clearEvents(): void {
    this._domainEvents = [];
  }

  public activate(): void {
    this.transitionTo('ACTIVE');
  }

  public cancel(): void {
    this.transitionTo('CANCELLED');
  }

  public expire(): void {
    this.transitionTo('EXPIRED');
  }

  public transitionTo(newStatus: EWayBillStatus): void {
    if (this._status === newStatus) return;

    const validTransitions: Record<EWayBillStatus, EWayBillStatus[]> = {
      GENERATED: ['ACTIVE', 'CANCELLED', 'EXPIRED'],
      ACTIVE: ['CANCELLED', 'EXPIRED'],
      CANCELLED: [],
      EXPIRED: [],
    };

    const allowed = validTransitions[this._status] || [];
    if (!allowed.includes(newStatus)) {
      throw new InvalidEWayBillStateTransitionError(
        `Cannot transition eWayBill from state '${this._status}' to '${newStatus}'`
      );
    }

    const oldStatus = this._status;
    this._status = newStatus;
    this._updatedAt = new Date();

    this._domainEvents.push({
      id: randomUUID(),
      name: `finance.ewaybill.${newStatus.toLowerCase()}`,
      occurredAt: new Date(),
      payload: {
        ewaybillId: this._id,
        tenantId: this._tenantId,
        invoiceId: this._invoiceId,
        ewayBillNumber: this._ewayBillNumber,
        distanceKm: this._distanceKm,
        oldStatus,
        newStatus,
        version: this._version,
      },
    });
  }

  public toJSON() {
    return {
      id: this._id,
      tenantId: this._tenantId,
      invoiceId: this._invoiceId,
      ewayBillNumber: this._ewayBillNumber,
      validUntil: this._validUntil ? this._validUntil.toISOString() : undefined,
      vehicleNumber: this._vehicleNumber,
      transporterId: this._transporterId,
      distanceKm: this._distanceKm,
      status: this._status,
      idempotencyKey: this._idempotencyKey,
      version: this._version,
      createdAt: this._createdAt.toISOString(),
      updatedAt: this._updatedAt.toISOString(),
    };
  }
}
