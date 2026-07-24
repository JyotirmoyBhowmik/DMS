import { randomUUID } from 'node:crypto';
import { DomainEvent } from './credit-note.entity.js';

export class CollectionDomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CollectionDomainError';
  }
}

export class InvalidCollectionStateTransitionError extends CollectionDomainError {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidCollectionStateTransitionError';
  }
}

export class CollectionValidationError extends CollectionDomainError {
  constructor(public readonly fields: Record<string, string>, message = 'Collection validation failed') {
    super(message);
    this.name = 'CollectionValidationError';
  }
}

export type CollectionStatus = 'DRAFT' | 'PENDING' | 'COLLECTED' | 'FAILED' | 'CANCELLED';

export interface CollectionProps {
  id?: string;
  tenantId: string;
  distributorId: string;
  invoiceId?: string;
  collectionReference: string;
  amountCents: number;
  collectionMode?: string;
  currency?: string;
  status?: CollectionStatus;
  idempotencyKey?: string;
  version?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export class Collection {
  private readonly _id: string;
  private readonly _tenantId: string;
  private readonly _distributorId: string;
  private readonly _invoiceId?: string;
  private readonly _collectionReference: string;
  private readonly _amountCents: number;
  private readonly _collectionMode: string;
  private readonly _currency: string;
  private _status: CollectionStatus;
  private readonly _idempotencyKey?: string;
  private _version: number;
  private readonly _createdAt: Date;
  private _updatedAt: Date;
  private _domainEvents: DomainEvent[] = [];

  constructor(props: CollectionProps) {
    if (!props.tenantId) throw new CollectionDomainError('tenantId is required');
    if (!props.distributorId) throw new CollectionDomainError('distributorId is required');
    if (!props.collectionReference || props.collectionReference.trim().length === 0) {
      throw new CollectionDomainError('collectionReference is required');
    }
    if (props.amountCents === undefined || props.amountCents <= 0) {
      throw new CollectionDomainError('amountCents must be > 0');
    }

    this._id = props.id || randomUUID();
    this._tenantId = props.tenantId;
    this._distributorId = props.distributorId;
    this._invoiceId = props.invoiceId;
    this._collectionReference = props.collectionReference;
    this._amountCents = props.amountCents;
    this._collectionMode = props.collectionMode || 'CASH';
    this._currency = props.currency || 'USD';
    this._status = props.status || 'DRAFT';
    this._idempotencyKey = props.idempotencyKey;
    this._version = props.version || 1;
    this._createdAt = props.createdAt || new Date();
    this._updatedAt = props.updatedAt || new Date();
  }

  get id(): string { return this._id; }
  get tenantId(): string { return this._tenantId; }
  get distributorId(): string { return this._distributorId; }
  get invoiceId(): string | undefined { return this._invoiceId; }
  get collectionReference(): string { return this._collectionReference; }
  get amountCents(): number { return this._amountCents; }
  get collectionMode(): string { return this._collectionMode; }
  get currency(): string { return this._currency; }
  get status(): CollectionStatus { return this._status; }
  get idempotencyKey(): string | undefined { return this._idempotencyKey; }
  get version(): number { return this._version; }
  get createdAt(): Date { return this._createdAt; }
  get updatedAt(): Date { return this._updatedAt; }
  get domainEvents(): DomainEvent[] { return [...this._domainEvents]; }

  public clearEvents(): void {
    this._domainEvents = [];
  }

  public markPending(): void {
    this.transitionTo('PENDING');
  }

  public markCollected(): void {
    this.transitionTo('COLLECTED');
  }

  public fail(): void {
    this.transitionTo('FAILED');
  }

  public cancel(): void {
    this.transitionTo('CANCELLED');
  }

  public transitionTo(newStatus: CollectionStatus): void {
    if (this._status === newStatus) return;

    const validTransitions: Record<CollectionStatus, CollectionStatus[]> = {
      DRAFT: ['PENDING', 'FAILED', 'CANCELLED'],
      PENDING: ['COLLECTED', 'FAILED', 'CANCELLED'],
      COLLECTED: [],
      FAILED: [],
      CANCELLED: [],
    };

    const allowed = validTransitions[this._status] || [];
    if (!allowed.includes(newStatus)) {
      throw new InvalidCollectionStateTransitionError(
        `Cannot transition collection from state '${this._status}' to '${newStatus}'`
      );
    }

    const oldStatus = this._status;
    this._status = newStatus;
    this._updatedAt = new Date();

    this._domainEvents.push({
      id: randomUUID(),
      name: `finance.collection.${newStatus.toLowerCase()}`,
      occurredAt: new Date(),
      payload: {
        collectionId: this._id,
        tenantId: this._tenantId,
        collectionReference: this._collectionReference,
        distributorId: this._distributorId,
        invoiceId: this._invoiceId,
        amountCents: this._amountCents,
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
      distributorId: this._distributorId,
      invoiceId: this._invoiceId,
      collectionReference: this._collectionReference,
      amountCents: this._amountCents,
      collectionMode: this._collectionMode,
      currency: this._currency,
      status: this._status,
      idempotencyKey: this._idempotencyKey,
      version: this._version,
      createdAt: this._createdAt.toISOString(),
      updatedAt: this._updatedAt.toISOString(),
    };
  }
}
