/**
 * TaxRule Domain Entity.
 * Represents tax rates and rules:
 * ACTIVE -> INACTIVE.
 */

export type TaxRuleStatus = 'ACTIVE' | 'INACTIVE';
export type TaxCode = 'GST_5' | 'GST_12' | 'GST_18' | 'GST_28' | 'VAT_STANDARD' | 'EXEMPT';

export interface TaxRuleProps {
  id: string;
  tenantId: string;
  name: string;
  taxCode: TaxCode;
  ratePercentage: number;
  status?: TaxRuleStatus;
  version?: number;
}

export class TaxRule {
  public readonly id: string;
  public readonly tenantId: string;
  private _name: string;
  public readonly taxCode: TaxCode;
  private _ratePercentage: number;
  private _status: TaxRuleStatus;
  private _version: number;

  public readonly domainEvents: Array<{ type: string; payload: any }> = [];

  constructor(props: TaxRuleProps) {
    if (!props.id || !props.tenantId || !props.name || !props.taxCode) {
      throw new Error('TaxRule must have id, tenantId, name, and taxCode');
    }
    if (props.ratePercentage < 0) {
      throw new Error('ratePercentage must be non-negative');
    }

    this.id = props.id;
    this.tenantId = props.tenantId;
    this._name = props.name;
    this.taxCode = props.taxCode;
    this._ratePercentage = props.ratePercentage;
    this._status = props.status ?? 'ACTIVE';
    this._version = props.version ?? 1;
  }

  get name(): string { return this._name; }
  get ratePercentage(): number { return this._ratePercentage; }
  get status(): TaxRuleStatus { return this._status; }
  get version(): number { return this._version; }

  static create(props: TaxRuleProps): TaxRule {
    const rule = new TaxRule(props);
    rule.domainEvents.push({
      type: 'pricing.tax_rule.created',
      payload: {
        id: rule.id,
        name: rule.name,
        taxCode: rule.taxCode,
        ratePercentage: rule.ratePercentage,
        status: rule.status,
      },
    });
    return rule;
  }

  updateStatus(newStatus: TaxRuleStatus): void {
    this._status = newStatus;
    this._version++;

    this.domainEvents.push({
      type: 'pricing.tax_rule.status_updated',
      payload: { id: this.id, status: this._status, version: this._version },
    });
  }

  toJSON() {
    return {
      id: this.id,
      tenantId: this.tenantId,
      name: this._name,
      taxCode: this.taxCode,
      ratePercentage: this._ratePercentage,
      status: this._status,
      version: this._version,
    };
  }
}
