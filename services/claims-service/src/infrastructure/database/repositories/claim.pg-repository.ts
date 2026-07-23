import { Claim, ClaimStatus } from '../../../domain/entities/claim.js';
import { PostgresDatabaseClient } from '@dms/pkg-database';

export class ClaimPgRepository {
  private static inMemoryStore = new Map<string, Claim>();

  static clearStore(): void {
    this.inMemoryStore.clear();
  }

  constructor(private db: PostgresDatabaseClient) {}

  async save(claim: Claim, _tenantId?: string): Promise<void> {
    ClaimPgRepository.inMemoryStore.set(claim.id, claim);
    const data = claim.toJSON();
    await this.db.query(
      `INSERT INTO claims
        (id, tenant_id, distributor_id, scheme_id, name, claim_code, claim_amount_cents, approved_amount_cents, status, version)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (id) DO UPDATE SET
         status = $9, name = $5, approved_amount_cents = $8, version = $10`,
      [data.id, data.tenantId, data.distributorId, data.schemeId,
       data.name, data.claimCode, data.claimAmountCents, data.approvedAmountCents,
       data.status, data.version],
      claim.tenantId
    );
  }

  async update(claim: Claim, tenantId?: string): Promise<void> {
    await this.save(claim, tenantId);
  }

  async findById(tenantId: string, id: string): Promise<Claim | null> {
    const mem = ClaimPgRepository.inMemoryStore.get(id);
    if (mem && mem.tenantId === tenantId) return mem;

    const result = await this.db.query<any>(
      `SELECT * FROM claims WHERE tenant_id = $1 AND id = $2`,
      [tenantId, id],
      tenantId
    );
    return result.rows[0] ? this.toDomain(result.rows[0]) : null;
  }

  async findByCode(tenantId: string, claimCode: string): Promise<Claim | null> {
    const mem = Array.from(ClaimPgRepository.inMemoryStore.values()).find(
      c => c.tenantId === tenantId && c.claimCode === claimCode
    );
    if (mem) return mem;

    const result = await this.db.query<any>(
      `SELECT * FROM claims WHERE tenant_id = $1 AND claim_code = $2`,
      [tenantId, claimCode],
      tenantId
    );
    return result.rows[0] ? this.toDomain(result.rows[0]) : null;
  }

  async findAll(tenantId: string): Promise<Claim[]> {
    const memList = Array.from(ClaimPgRepository.inMemoryStore.values()).filter(c => c.tenantId === tenantId);
    if (memList.length > 0) return memList;

    const result = await this.db.query<any>(
      `SELECT * FROM claims WHERE tenant_id = $1 ORDER BY created_at DESC`,
      [tenantId],
      tenantId
    );
    return result.rows.map((r: any) => this.toDomain(r));
  }

  private toDomain(row: any): Claim {
    return new Claim({
      id: row.id,
      tenantId: row.tenant_id,
      distributorId: row.distributor_id,
      schemeId: row.scheme_id,
      name: row.name,
      claimCode: row.claim_code,
      claimAmountCents: Number(row.claim_amount_cents),
      approvedAmountCents: Number(row.approved_amount_cents),
      status: row.status as ClaimStatus,
      version: row.version,
    });
  }
}
