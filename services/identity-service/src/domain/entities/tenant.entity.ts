import { randomUUID } from 'node:crypto';

export class TenantDomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TenantDomainError';
  }
}

export class InvalidTenantStateTransitionError extends TenantDomainError {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidTenantStateTransitionError';
  }
}

export class TenantValidationError extends TenantDomainError {
  constructor(public readonly fields: Record<string, string>, message = 'Tenant validation failed') {
    const detail = Object.values(fields).join('; ');
    super(detail ? `${message}: ${detail}` : message);
    this.name = 'TenantValidationError';
  }
}

export type TenantStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
export type PlanTier = 'FREE' | 'STARTER' | 'PROFESSIONAL' | 'ENTERPRISE';
export type IsolationTier = 'SHARED_RLS' | 'SCHEMA_PER_TENANT' | 'DEDICATED_CLUSTER';

export interface ErpConfig {
  type: 'SAP' | 'ORACLE' | 'DYNAMICS' | 'CUSTOM' | 'NONE';
  endpoint?: string;
  apiKey?: string;
  status?: 'CONNECTED' | 'DISCONNECTED';
}

export interface BrandingConfig {
  logoUrl?: string;
  primaryColor?: string;
  secondaryColor?: string;
  customTitle?: string;
}

export interface DomainEvent {
  id: string;
  name: string;
  occurredAt: Date;
  payload: Record<string, any>;
}

export interface TenantProps {
  id?: string;
  tenantId?: string;
  name: string;
  code: string;
  domain?: string;
  subdomain?: string;
  customDomain?: string;
  planTier?: PlanTier;
  isolationTier?: IsolationTier;
  region?: string;
  erpConfig?: ErpConfig;
  channelModules?: string[];
  branding?: BrandingConfig;
  status?: TenantStatus;
  idempotencyKey?: string;
  version?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export class TenantAggregate {
  private readonly _id: string;
  private readonly _tenantId: string;
  private _name: string;
  private _code: string;
  private _domain?: string;
  private _subdomain?: string;
  private _customDomain?: string;
  private _planTier: PlanTier;
  private _isolationTier: IsolationTier;
  private _region: string;
  private _erpConfig: ErpConfig;
  private _channelModules: string[];
  private _branding: BrandingConfig;
  private _status: TenantStatus;
  private readonly _idempotencyKey?: string;
  private _version: number;
  private readonly _createdAt: Date;
  private _updatedAt: Date;
  private _domainEvents: DomainEvent[] = [];

  constructor(props: TenantProps) {
    if (!props.name || props.name.trim().length === 0) {
      throw new TenantDomainError('name is required and cannot be empty');
    }
    if (!props.code || props.code.trim().length === 0) {
      throw new TenantDomainError('code is required and cannot be empty');
    }

    this._id = props.id || randomUUID();
    this._tenantId = props.tenantId || this._id;
    this._name = props.name.trim();
    this._code = props.code.trim().toUpperCase();
    this._domain = props.domain ? props.domain.trim().toLowerCase() : undefined;
    this._subdomain = props.subdomain ? props.subdomain.trim().toLowerCase() : props.code.toLowerCase();
    this._customDomain = props.customDomain ? props.customDomain.trim().toLowerCase() : undefined;
    this._planTier = props.planTier || 'PROFESSIONAL';
    this._isolationTier = props.isolationTier || (props.planTier === 'ENTERPRISE' ? 'DEDICATED_CLUSTER' : 'SHARED_RLS');
    this._region = props.region || 'singapore';
    this._erpConfig = props.erpConfig || { type: 'NONE', status: 'DISCONNECTED' };
    this._channelModules = props.channelModules || ['DMS_CORE', 'SFA', 'VAN_SALES', 'TRADE_SCHEMES'];
    this._branding = props.branding || { primaryColor: '#0F172A', customTitle: props.name };
    this._status = props.status || 'ACTIVE';
    this._idempotencyKey = props.idempotencyKey;
    this._version = props.version || 1;
    this._createdAt = props.createdAt || new Date();
    this._updatedAt = props.updatedAt || new Date();
  }

  get id(): string { return this._id; }
  get tenantId(): string { return this._tenantId; }
  get name(): string { return this._name; }
  get code(): string { return this._code; }
  get domain(): string | undefined { return this._domain; }
  get subdomain(): string | undefined { return this._subdomain; }
  get customDomain(): string | undefined { return this._customDomain; }
  get planTier(): PlanTier { return this._planTier; }
  get isolationTier(): IsolationTier { return this._isolationTier; }
  get region(): string { return this._region; }
  get erpConfig(): ErpConfig { return { ...this._erpConfig }; }
  get channelModules(): string[] { return [...this._channelModules]; }
  get branding(): BrandingConfig { return { ...this._branding }; }
  get status(): TenantStatus { return this._status; }
  get idempotencyKey(): string | undefined { return this._idempotencyKey; }
  get version(): number { return this._version; }
  get createdAt(): Date { return this._createdAt; }
  get updatedAt(): Date { return this._updatedAt; }
  get domainEvents(): DomainEvent[] { return [...this._domainEvents]; }

  public clearEvents(): void {
    this._domainEvents = [];
  }

  public updateProfile(name: string, domain?: string): void {
    if (!name || name.trim().length === 0) {
      throw new TenantDomainError('name cannot be empty');
    }
    this._name = name.trim();
    this._domain = domain ? domain.trim().toLowerCase() : undefined;
    this._updatedAt = new Date();
  }

  public activate(): void {
    this.transitionTo('ACTIVE');
  }

  public deactivate(): void {
    this.transitionTo('INACTIVE');
  }

  public suspend(): void {
    this.transitionTo('SUSPENDED');
  }

  public transitionTo(newStatus: TenantStatus): void {
    if (this._status === newStatus) return;

    const validTransitions: Record<TenantStatus, TenantStatus[]> = {
      ACTIVE: ['INACTIVE', 'SUSPENDED'],
      INACTIVE: ['ACTIVE', 'SUSPENDED'],
      SUSPENDED: ['ACTIVE'],
    };

    const allowed = validTransitions[this._status] || [];
    if (!allowed.includes(newStatus)) {
      throw new InvalidTenantStateTransitionError(
        `Cannot transition Tenant from state '${this._status}' to '${newStatus}'`
      );
    }

    const oldStatus = this._status;
    this._status = newStatus;
    this._updatedAt = new Date();

    this._domainEvents.push({
      id: randomUUID(),
      name: `identity.tenant.${newStatus.toLowerCase()}`,
      occurredAt: new Date(),
      payload: {
        tenantId: this._id,
        name: this._name,
        code: this._code,
        oldStatus,
        newStatus,
        version: this._version,
      },
    });
  }

  public updateErpConfig(erp: Partial<ErpConfig>): void {
    this._erpConfig = { ...this._erpConfig, ...erp };
    this._updatedAt = new Date();
  }

  public updateBranding(branding: Partial<BrandingConfig>): void {
    this._branding = { ...this._branding, ...branding };
    this._updatedAt = new Date();
  }

  public updateModules(modules: string[]): void {
    this._channelModules = [...modules];
    this._updatedAt = new Date();
  }

  public updatePlan(planTier: PlanTier, isolationTier?: IsolationTier): void {
    this._planTier = planTier;
    if (isolationTier) {
      this._isolationTier = isolationTier;
    }
    this._updatedAt = new Date();
  }

  public toJSON() {
    return {
      id: this._id,
      tenantId: this._tenantId,
      name: this._name,
      code: this._code,
      domain: this._domain,
      subdomain: this._subdomain,
      customDomain: this._customDomain,
      planTier: this._planTier,
      isolationTier: this._isolationTier,
      region: this._region,
      erpConfig: this._erpConfig,
      channelModules: this._channelModules,
      branding: this._branding,
      status: this._status,
      idempotencyKey: this._idempotencyKey,
      version: this._version,
      createdAt: this._createdAt.toISOString(),
      updatedAt: this._updatedAt.toISOString(),
    };
  }
}
