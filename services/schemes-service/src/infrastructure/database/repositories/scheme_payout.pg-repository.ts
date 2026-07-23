import { SchemePayout, SchemePayoutStatus, PayoutType } from '../../../domain/entities/scheme_payout.js';
import { PostgresDatabaseClient } from '@dms/pkg-database';

export class SchemePayoutPgRepository {
  private static inMemoryStore = new Map<string, SchemePayout>();

  static clearStore(): void {
    this.inMemoryStore.clear();
  }

  constructor(private db: PostgresDatabaseClient) {}

  async save(payout: SchemePayout, _tenantId?: string): Promise<void> {
    SchemePayoutPgRepository.inMemoryStore.set(payout.id, payout);
    const data = payout.toJSON();
    await this.db.query(
      `INSERT INTO scheme_payouts
        (id, tenant_id, scheme_id, distributor_id, claim_id, name, payout_code, amount_cents, payout_type, status, version)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       ON CONFLICT (id) DO UPDATE SET
         status = $10, name = $6, amount_cents = $8, version = $11`,
      [data.id, data.tenantId, data.schemeId, data.distributorId, data.claimId,
       data.name, data.payoutCode, data.amountCents, data.payoutType,
       data.status, data.version],
      payout.tenantId
    );
  }

  async update(payout: SchemePayout, tenantId?: string): Promise<void> {
    await this.save(payout, tenantId);
  }

  async findById(tenantId: string, id: string): Promise<SchemePayout | null> {
    const mem = SchemePayoutPgRepository.inMemoryStore.get(id);
    if (mem && mem.tenantId === tenantId) return mem;

    const result = await this.db.query<any>(
      `SELECT * FROM scheme_payouts WHERE tenant_id = $1 AND id = $2`,
      [tenantId, id],
      tenantId
    );
    return result.rows[0] ? this.toDomain(result.rows[0]) : null;
  }

  async findByCode(tenantId: string, schemeId: string, payoutCode: string): Promise<SchemePayout | null> {
    const mem = Array.from(SchemePayoutPgRepository.inMemoryStore.values()).find(
      p => p.tenantId === tenantId && p.schemeId === schemeId && p.payoutCode === payoutCode
    );
    if (mem) return mem;

    const result = await this.db.query<any>(
      `SELECT * FROM scheme_payouts WHERE tenant_id = $1 AND scheme_id = $2 AND payout_code = $3`,
      [tenantId, schemeId, payoutCode],
      tenantId
    );
    return result.rows[0] ? this.toDomain(result.rows[0]) : null;
  }

  async findAll(tenantId: string): Promise<SchemePayout[]> {
    const memList = Array.from(SchemePayoutPgRepository.inMemoryStore.values()).filter(p => p.tenantId === tenantId);
    if (memList.length > 0) return memList;

    const result = await this.db.query<any>(
      `SELECT * FROM scheme_payouts WHERE tenant_id = $1 ORDER BY created_at DESC`,
      [tenantId],
      tenantId
    );
    return result.rows.map((r: any) => this.toDomain(r));
  }

  private toDomain(row: any): SchemePayout {
    return new SchemePayout({
      id: row.id,
      tenantId: row.tenant_id,
      schemeId: row.scheme_id,
      distributorId: row.distributor_id,
      claimId: row.claim_id,
      name: row.name,
      payoutCode: row.payout_code,
      amountCents: Number(row.amount_cents),
      payoutType: row.payout_type as PayoutType,
      status: row.status as SchemePayoutStatus,
      version: row.version,
    });
  }
}
