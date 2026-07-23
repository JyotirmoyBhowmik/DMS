import { SlabReward, SlabRewardStatus, RewardType } from '../../../domain/entities/slab_reward.js';
import { PostgresDatabaseClient } from '@dms/pkg-database';

export class SlabRewardPgRepository {
  private static inMemoryStore = new Map<string, SlabReward>();

  static clearStore(): void {
    this.inMemoryStore.clear();
  }

  constructor(private db: PostgresDatabaseClient) {}

  async save(reward: SlabReward, _tenantId?: string): Promise<void> {
    SlabRewardPgRepository.inMemoryStore.set(reward.id, reward);
    const data = reward.toJSON();
    await this.db.query(
      `INSERT INTO slab_rewards
        (id, tenant_id, scheme_id, name, slab_code, min_qualifying_qty, reward_type, reward_value_cents, reward_sku_id, status, version)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       ON CONFLICT (id) DO UPDATE SET
         status = $10, name = $4, min_qualifying_qty = $6, reward_value_cents = $8, version = $11`,
      [data.id, data.tenantId, data.schemeId, data.name, data.slabCode,
       data.minQualifyingQty, data.rewardType, data.rewardValueCents, data.rewardSkuId,
       data.status, data.version],
      reward.tenantId
    );
  }

  async update(reward: SlabReward, tenantId?: string): Promise<void> {
    await this.save(reward, tenantId);
  }

  async findById(tenantId: string, id: string): Promise<SlabReward | null> {
    const mem = SlabRewardPgRepository.inMemoryStore.get(id);
    if (mem && mem.tenantId === tenantId) return mem;

    const result = await this.db.query<any>(
      `SELECT * FROM slab_rewards WHERE tenant_id = $1 AND id = $2`,
      [tenantId, id],
      tenantId
    );
    return result.rows[0] ? this.toDomain(result.rows[0]) : null;
  }

  async findByCode(tenantId: string, schemeId: string, slabCode: string): Promise<SlabReward | null> {
    const mem = Array.from(SlabRewardPgRepository.inMemoryStore.values()).find(
      r => r.tenantId === tenantId && r.schemeId === schemeId && r.slabCode === slabCode
    );
    if (mem) return mem;

    const result = await this.db.query<any>(
      `SELECT * FROM slab_rewards WHERE tenant_id = $1 AND scheme_id = $2 AND slab_code = $3`,
      [tenantId, schemeId, slabCode],
      tenantId
    );
    return result.rows[0] ? this.toDomain(result.rows[0]) : null;
  }

  async findAll(tenantId: string): Promise<SlabReward[]> {
    const memList = Array.from(SlabRewardPgRepository.inMemoryStore.values()).filter(r => r.tenantId === tenantId);
    if (memList.length > 0) return memList;

    const result = await this.db.query<any>(
      `SELECT * FROM slab_rewards WHERE tenant_id = $1 ORDER BY created_at DESC`,
      [tenantId],
      tenantId
    );
    return result.rows.map((r: any) => this.toDomain(r));
  }

  private toDomain(row: any): SlabReward {
    return new SlabReward({
      id: row.id,
      tenantId: row.tenant_id,
      schemeId: row.scheme_id,
      name: row.name,
      slabCode: row.slab_code,
      minQualifyingQty: Number(row.min_qualifying_qty),
      rewardType: row.reward_type as RewardType,
      rewardValueCents: Number(row.reward_value_cents),
      rewardSkuId: row.reward_sku_id,
      status: row.status as SlabRewardStatus,
      version: row.version,
    });
  }
}
