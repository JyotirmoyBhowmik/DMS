import { ChannelPriceRule, ChannelPriceRuleStatus, ChannelCode } from '../../../domain/entities/channel_price_rule.js';
import { PostgresDatabaseClient } from '@dms/pkg-database';

export class ChannelPriceRulePgRepository {
  private static inMemoryStore = new Map<string, ChannelPriceRule>();

  static clearStore(): void {
    this.inMemoryStore.clear();
  }

  constructor(private db: PostgresDatabaseClient) {}

  async save(rule: ChannelPriceRule, _tenantId?: string): Promise<void> {
    ChannelPriceRulePgRepository.inMemoryStore.set(rule.id, rule);
    const data = rule.toJSON();
    await this.db.query(
      `INSERT INTO channel_price_rules
        (id, tenant_id, price_list_id, channel_code, multiplier, price_adjustment_cents, status, version)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (id) DO UPDATE SET
         status = $7, multiplier = $5, price_adjustment_cents = $6, version = $8`,
      [data.id, data.tenantId, data.priceListId, data.channelCode, data.multiplier,
       data.priceAdjustmentCents, data.status, data.version],
      rule.tenantId
    );
  }

  async update(rule: ChannelPriceRule, tenantId?: string): Promise<void> {
    await this.save(rule, tenantId);
  }

  async findById(tenantId: string, id: string): Promise<ChannelPriceRule | null> {
    const mem = ChannelPriceRulePgRepository.inMemoryStore.get(id);
    if (mem && mem.tenantId === tenantId) return mem;

    const result = await this.db.query<any>(
      `SELECT * FROM channel_price_rules WHERE tenant_id = $1 AND id = $2`,
      [tenantId, id],
      tenantId
    );
    return result.rows[0] ? this.toDomain(result.rows[0]) : null;
  }

  async findByChannel(tenantId: string, priceListId: string, channelCode: ChannelCode): Promise<ChannelPriceRule | null> {
    const mem = Array.from(ChannelPriceRulePgRepository.inMemoryStore.values()).find(
      r => r.tenantId === tenantId && r.priceListId === priceListId && r.channelCode === channelCode
    );
    if (mem) return mem;

    const result = await this.db.query<any>(
      `SELECT * FROM channel_price_rules WHERE tenant_id = $1 AND price_list_id = $2 AND channel_code = $3`,
      [tenantId, priceListId, channelCode],
      tenantId
    );
    return result.rows[0] ? this.toDomain(result.rows[0]) : null;
  }

  async findAll(tenantId: string): Promise<ChannelPriceRule[]> {
    const memList = Array.from(ChannelPriceRulePgRepository.inMemoryStore.values()).filter(r => r.tenantId === tenantId);
    if (memList.length > 0) return memList;

    const result = await this.db.query<any>(
      `SELECT * FROM channel_price_rules WHERE tenant_id = $1 ORDER BY created_at DESC`,
      [tenantId],
      tenantId
    );
    return result.rows.map((r: any) => this.toDomain(r));
  }

  private toDomain(row: any): ChannelPriceRule {
    return new ChannelPriceRule({
      id: row.id,
      tenantId: row.tenant_id,
      priceListId: row.price_list_id,
      channelCode: row.channel_code as ChannelCode,
      multiplier: Number(row.multiplier),
      priceAdjustmentCents: Number(row.price_adjustment_cents),
      status: row.status as ChannelPriceRuleStatus,
      version: row.version,
    });
  }
}
