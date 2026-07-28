export type AuditLogSource = 'WEB' | 'MOBILE' | 'API' | 'SYSTEM';
export type AuditLogStatus = 'SUCCESS' | 'FAILURE' | 'SUSPICIOUS';

export interface AuditLogProps {
  id: string;
  tenantId: string;
  actorId: string;
  action: string;
  entityType: string;
  entityId: string;
  source: AuditLogSource;
  correlationId?: string | null;
  details: Record<string, any>;
  ipAddress?: string | null;
  status: AuditLogStatus;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export class AuditLogDomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuditLogDomainError';
  }
}

export class AuditLogAggregate {
  private props: AuditLogProps;

  constructor(props: AuditLogProps) {
    this.validate(props);
    this.props = { ...props };
  }

  private validate(props: AuditLogProps): void {
    if (!props.id || props.id.trim().length === 0) {
      throw new AuditLogDomainError('AuditLog ID is required.');
    }
    if (!props.tenantId || props.tenantId.trim().length === 0) {
      throw new AuditLogDomainError('AuditLog tenantId is required.');
    }
    if (!props.actorId || props.actorId.trim().length === 0) {
      throw new AuditLogDomainError('AuditLog actorId is required.');
    }
    if (!props.action || props.action.trim().length === 0) {
      throw new AuditLogDomainError('AuditLog action is required.');
    }
    if (!props.entityType || props.entityType.trim().length === 0) {
      throw new AuditLogDomainError('AuditLog entityType is required.');
    }
    if (!props.entityId || props.entityId.trim().length === 0) {
      throw new AuditLogDomainError('AuditLog entityId is required.');
    }

    const validSources: AuditLogSource[] = ['WEB', 'MOBILE', 'API', 'SYSTEM'];
    if (!props.source || !validSources.includes(props.source)) {
      throw new AuditLogDomainError(`Invalid AuditLog source: ${props.source}`);
    }

    const validStatuses: AuditLogStatus[] = ['SUCCESS', 'FAILURE', 'SUSPICIOUS'];
    if (!props.status || !validStatuses.includes(props.status)) {
      throw new AuditLogDomainError(`Invalid AuditLog status: ${props.status}`);
    }

    if (props.version < 1) {
      throw new AuditLogDomainError('AuditLog version must be >= 1.');
    }
  }

  public static create(params: {
    id: string;
    tenantId: string;
    actorId: string;
    action: string;
    entityType: string;
    entityId: string;
    source?: AuditLogSource;
    correlationId?: string;
    details?: Record<string, any>;
    ipAddress?: string;
    status?: AuditLogStatus;
  }): AuditLogAggregate {
    const now = new Date();
    return new AuditLogAggregate({
      id: params.id,
      tenantId: params.tenantId,
      actorId: params.actorId,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      source: params.source ?? 'WEB',
      correlationId: params.correlationId ?? null,
      details: params.details ?? {},
      ipAddress: params.ipAddress ?? null,
      status: params.status ?? 'SUCCESS',
      version: 1,
      createdAt: now,
      updatedAt: now
    });
  }

  public updateStatus(newStatus: AuditLogStatus, expectedVersion: number): void {
    if (this.props.version !== expectedVersion) {
      throw new AuditLogDomainError(`Optimistic locking failure: expected version ${expectedVersion}, found ${this.props.version}`);
    }

    const validStatuses: AuditLogStatus[] = ['SUCCESS', 'FAILURE', 'SUSPICIOUS'];
    if (!validStatuses.includes(newStatus)) {
      throw new AuditLogDomainError(`Invalid AuditLog status: ${newStatus}`);
    }

    this.props.status = newStatus;
    this.props.version += 1;
    this.props.updatedAt = new Date();
  }

  public get id(): string { return this.props.id; }
  public get tenantId(): string { return this.props.tenantId; }
  public get actorId(): string { return this.props.actorId; }
  public get action(): string { return this.props.action; }
  public get entityType(): string { return this.props.entityType; }
  public get entityId(): string { return this.props.entityId; }
  public get source(): AuditLogSource { return this.props.source; }
  public get correlationId(): string | null | undefined { return this.props.correlationId; }
  public get details(): Record<string, any> { return { ...this.props.details }; }
  public get ipAddress(): string | null | undefined { return this.props.ipAddress; }
  public get status(): AuditLogStatus { return this.props.status; }
  public get version(): number { return this.props.version; }
  public get createdAt(): Date { return this.props.createdAt; }
  public get updatedAt(): Date { return this.props.updatedAt; }
}
