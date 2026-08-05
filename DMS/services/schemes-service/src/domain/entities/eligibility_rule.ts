/**
 * EligibilityRule Domain Entity.
 * Represents conditions for scheme qualification:
 * ACTIVE -> INACTIVE.
 */

export type EligibilityRuleStatus = 'ACTIVE' | 'INACTIVE';
export type RuleType = 'MIN_ORDER_VALUE' | 'TARGET_CHANNEL' | 'GEOGRAPHIC_ZONE' | 'CUSTOMER_TIER';

export interface EligibilityRuleProps {
  id: string;
  tenantId: string;
  schemeId: string;
  name: string;
  ruleCode: string;
  ruleType?: RuleType;
  minOrderValueCents?: number;
  targetValue?: string;
  status?: EligibilityRuleStatus;
  version?: number;
}

export class EligibilityRule {
  public readonly id: string;
  public readonly tenantId: string;
  public readonly schemeId: string;
  private _name: string;
  public readonly ruleCode: string;
  public readonly ruleType: RuleType;
  private _minOrderValueCents: number;
  private _targetValue: string;
  private _status: EligibilityRuleStatus;
  private _version: number;

  public readonly domainEvents: Array<{ type: string; payload: any }> = [];

  constructor(props: EligibilityRuleProps) {
    if (!props.id || !props.tenantId || !props.schemeId || !props.name || !props.ruleCode) {
      throw new Error('EligibilityRule must have id, tenantId, schemeId, name, and ruleCode');
    }
    if (props.minOrderValueCents !== undefined && props.minOrderValueCents < 0) {
      throw new Error('minOrderValueCents must be non-negative');
    }

    this.id = props.id;
    this.tenantId = props.tenantId;
    this.schemeId = props.schemeId;
    this._name = props.name;
    this.ruleCode = props.ruleCode;
    this.ruleType = props.ruleType ?? 'MIN_ORDER_VALUE';
    this._minOrderValueCents = props.minOrderValueCents ?? 0;
    this._targetValue = props.targetValue ?? '';
    this._status = props.status ?? 'ACTIVE';
    this._version = props.version ?? 1;
  }

  get name(): string { return this._name; }
  get minOrderValueCents(): number { return this._minOrderValueCents; }
  get targetValue(): string { return this._targetValue; }
  get status(): EligibilityRuleStatus { return this._status; }
  get version(): number { return this._version; }

  static create(props: EligibilityRuleProps): EligibilityRule {
    const rule = new EligibilityRule(props);
    rule.domainEvents.push({
      type: 'schemes.eligibility_rule.created',
      payload: {
        id: rule.id,
        schemeId: rule.schemeId,
        name: rule.name,
        ruleCode: rule.ruleCode,
        ruleType: rule.ruleType,
        status: rule.status,
      },
    });
    return rule;
  }

  updateStatus(newStatus: EligibilityRuleStatus): void {
    this._status = newStatus;
    this._version++;

    this.domainEvents.push({
      type: 'schemes.eligibility_rule.status_updated',
      payload: { id: this.id, status: this._status, version: this._version },
    });
  }

  toJSON() {
    return {
      id: this.id,
      tenantId: this.tenantId,
      schemeId: this.schemeId,
      name: this._name,
      ruleCode: this.ruleCode,
      ruleType: this.ruleType,
      minOrderValueCents: this._minOrderValueCents,
      targetValue: this._targetValue,
      status: this._status,
      version: this._version,
    };
  }
}
