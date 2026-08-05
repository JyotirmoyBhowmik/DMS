/**
 * SlabReward Domain Entity.
 * Represents reward payout tier for a scheme:
 * ACTIVE -> INACTIVE.
 */

export type SlabRewardStatus = 'ACTIVE' | 'INACTIVE';
export type RewardType = 'CASHBACK' | 'FREE_PRODUCT' | 'POINTS';

export interface SlabRewardProps {
  id: string;
  tenantId: string;
  schemeId: string;
  name: string;
  slabCode: string;
  minQualifyingQty?: number;
  rewardType?: RewardType;
  rewardValueCents?: number;
  rewardSkuId?: string;
  status?: SlabRewardStatus;
  version?: number;
}

export class SlabReward {
  public readonly id: string;
  public readonly tenantId: string;
  public readonly schemeId: string;
  private _name: string;
  public readonly slabCode: string;
  private _minQualifyingQty: number;
  public readonly rewardType: RewardType;
  private _rewardValueCents: number;
  private _rewardSkuId: string;
  private _status: SlabRewardStatus;
  private _version: number;

  public readonly domainEvents: Array<{ type: string; payload: any }> = [];

  constructor(props: SlabRewardProps) {
    if (!props.id || !props.tenantId || !props.schemeId || !props.name || !props.slabCode) {
      throw new Error('SlabReward must have id, tenantId, schemeId, name, and slabCode');
    }
    if (props.minQualifyingQty !== undefined && props.minQualifyingQty < 0) {
      throw new Error('minQualifyingQty must be non-negative');
    }
    if (props.rewardValueCents !== undefined && props.rewardValueCents < 0) {
      throw new Error('rewardValueCents must be non-negative');
    }

    this.id = props.id;
    this.tenantId = props.tenantId;
    this.schemeId = props.schemeId;
    this._name = props.name;
    this.slabCode = props.slabCode;
    this._minQualifyingQty = props.minQualifyingQty ?? 1;
    this.rewardType = props.rewardType ?? 'CASHBACK';
    this._rewardValueCents = props.rewardValueCents ?? 0;
    this._rewardSkuId = props.rewardSkuId ?? '';
    this._status = props.status ?? 'ACTIVE';
    this._version = props.version ?? 1;
  }

  get name(): string { return this._name; }
  get minQualifyingQty(): number { return this._minQualifyingQty; }
  get rewardValueCents(): number { return this._rewardValueCents; }
  get rewardSkuId(): string { return this._rewardSkuId; }
  get status(): SlabRewardStatus { return this._status; }
  get version(): number { return this._version; }

  static create(props: SlabRewardProps): SlabReward {
    const reward = new SlabReward(props);
    reward.domainEvents.push({
      type: 'schemes.slab_reward.created',
      payload: {
        id: reward.id,
        schemeId: reward.schemeId,
        name: reward.name,
        slabCode: reward.slabCode,
        rewardType: reward.rewardType,
        status: reward.status,
      },
    });
    return reward;
  }

  updateStatus(newStatus: SlabRewardStatus): void {
    this._status = newStatus;
    this._version++;

    this.domainEvents.push({
      type: 'schemes.slab_reward.status_updated',
      payload: { id: this.id, status: this._status, version: this._version },
    });
  }

  toJSON() {
    return {
      id: this.id,
      tenantId: this.tenantId,
      schemeId: this.schemeId,
      name: this._name,
      slabCode: this.slabCode,
      minQualifyingQty: this._minQualifyingQty,
      rewardType: this.rewardType,
      rewardValueCents: this._rewardValueCents,
      rewardSkuId: this._rewardSkuId,
      status: this._status,
      version: this._version,
    };
  }
}
