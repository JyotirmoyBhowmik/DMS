import { SchemeClaim, SchemeClaimStatus } from '../../../domain/entities/scheme_claim.js';

export class ConcurrencyError extends Error {

  constructor(message: string) {
    super(message);
    this.name = 'ConcurrencyError';
  }
}

export class EntityNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EntityNotFoundError';
  }
}

export interface ISchemeClaimRepository {
  save(claim: SchemeClaim, tenantId: string): Promise<void>;
  findById(id: string, tenantId: string): Promise<SchemeClaim | null>;
  findByCode(claimCode: string, tenantId: string): Promise<SchemeClaim | null>;
  update(claim: SchemeClaim, tenantId: string): Promise<SchemeClaim>;
  list(
    tenantId: string,
    filters?: { status?: SchemeClaimStatus; schemeId?: string; distributorId?: string },
    pagination?: { page: number; limit: number }
  ): Promise<{ data: SchemeClaim[]; total: number }>;
}

export class SchemeClaimPgRepository implements ISchemeClaimRepository {
  static inMemoryStore = new Map<string, SchemeClaim>();

  static clearStore() {
    SchemeClaimPgRepository.inMemoryStore.clear();
  }

  constructor(private db?: any) {}


  async save(claim: SchemeClaim, tenantId: string): Promise<void> {
    if (!this.db) {
      SchemeClaimPgRepository.inMemoryStore.set(`${tenantId}:${claim.id}`, claim);
      return;
    }

    await this.db.query(
      `SET LOCAL app.current_tenant_id = $1;`,
      [tenantId]
    );

    const query = `
      INSERT INTO scheme_claims (
        id, tenant_id, claim_code, scheme_id, distributor_id,
        claim_amount_cents, approved_amount_cents, status, version, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11);
    `;

    const values = [
      claim.id,
      tenantId,
      claim.claimCode,
      claim.schemeId,
      claim.distributorId,
      claim.claimAmountCents,
      claim.approvedAmountCents,
      claim.status,
      claim.version,
      claim.createdAt,
      claim.updatedAt,
    ];

    await this.db.query(query, values);
  }

  async findById(id: string, tenantId: string): Promise<SchemeClaim | null> {
    if (!this.db) {
      const found = SchemeClaimPgRepository.inMemoryStore.get(`${tenantId}:${id}`);
      return found || null;
    }

    const result = await this.db.query(
      `SELECT * FROM scheme_claims WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId]
    );

    if (result.rows.length === 0) return null;
    return this.mapToEntity(result.rows[0]);
  }

  async findByCode(claimCode: string, tenantId: string): Promise<SchemeClaim | null> {
    if (!this.db) {
      for (const item of SchemeClaimPgRepository.inMemoryStore.values()) {
        if (item.tenantId === tenantId && item.claimCode === claimCode) {
          return item;
        }
      }
      return null;
    }

    const result = await this.db.query(
      `SELECT * FROM scheme_claims WHERE claim_code = $1 AND tenant_id = $2`,
      [claimCode, tenantId]
    );

    if (result.rows.length === 0) return null;
    return this.mapToEntity(result.rows[0]);
  }

  async update(claim: SchemeClaim, tenantId: string): Promise<SchemeClaim> {
    if (!this.db) {
      const key = `${tenantId}:${claim.id}`;
      const existing = SchemeClaimPgRepository.inMemoryStore.get(key);
      if (!existing) throw new EntityNotFoundError('SchemeClaim not found');
      if (existing.version !== claim.version) {
        throw new ConcurrencyError('Version conflict: entity has been modified');
      }

      const updated = new SchemeClaim({
        id: claim.id,
        tenantId: claim.tenantId,
        claimCode: claim.claimCode,
        schemeId: claim.schemeId,
        distributorId: claim.distributorId,
        claimAmountCents: claim.claimAmountCents,
        approvedAmountCents: claim.approvedAmountCents,
        status: claim.status,
        version: claim.version + 1,
        createdAt: claim.createdAt,
        updatedAt: new Date(),
      });

      SchemeClaimPgRepository.inMemoryStore.set(key, updated);
      return updated;
    }

    const nextVersion = claim.version + 1;
    const query = `
      UPDATE scheme_claims SET
        approved_amount_cents = $1,
        status = $2,
        version = $3,
        updated_at = NOW()
      WHERE id = $4 AND tenant_id = $5 AND version = $6
      RETURNING *;
    `;

    const result = await this.db.query(query, [
      claim.approvedAmountCents,
      claim.status,
      nextVersion,
      claim.id,
      tenantId,
      claim.version,
    ]);

    if (result.rows.length === 0) {
      const existing = await this.findById(claim.id, tenantId);
      if (!existing) throw new EntityNotFoundError('SchemeClaim not found');
      throw new ConcurrencyError('Version conflict: entity has been modified');
    }

    return this.mapToEntity(result.rows[0]);
  }

  async list(
    tenantId: string,
    filters?: { status?: SchemeClaimStatus; schemeId?: string; distributorId?: string },
    pagination: { page: number; limit: number } = { page: 1, limit: 20 }
  ): Promise<{ data: SchemeClaim[]; total: number }> {
    if (!this.db) {
      let all = Array.from(SchemeClaimPgRepository.inMemoryStore.values()).filter(
        i => i.tenantId === tenantId
      );

      if (filters?.status) all = all.filter(i => i.status === filters.status);
      if (filters?.schemeId) all = all.filter(i => i.schemeId === filters.schemeId);
      if (filters?.distributorId) all = all.filter(i => i.distributorId === filters.distributorId);

      const offset = (pagination.page - 1) * pagination.limit;
      const data = all.slice(offset, offset + pagination.limit);
      return { data, total: all.length };
    }

    let whereClause = `WHERE tenant_id = $1`;
    const params: any[] = [tenantId];
    let paramIdx = 2;

    if (filters?.status) {
      whereClause += ` AND status = $${paramIdx++}`;
      params.push(filters.status);
    }
    if (filters?.schemeId) {
      whereClause += ` AND scheme_id = $${paramIdx++}`;
      params.push(filters.schemeId);
    }
    if (filters?.distributorId) {
      whereClause += ` AND distributor_id = $${paramIdx++}`;
      params.push(filters.distributorId);
    }

    const countRes = await this.db.query(
      `SELECT COUNT(*)::int as total FROM scheme_claims ${whereClause}`,
      params
    );
    const total = countRes.rows[0]?.total || 0;

    const offset = (pagination.page - 1) * pagination.limit;
    params.push(pagination.limit, offset);
    const dataRes = await this.db.query(
      `SELECT * FROM scheme_claims ${whereClause} ORDER BY created_at DESC LIMIT $${paramIdx++} OFFSET $${paramIdx++}`,
      params
    );

    return {
      data: dataRes.rows.map((row: any) => this.mapToEntity(row)),

      total,
    };
  }

  private mapToEntity(row: any): SchemeClaim {


    return new SchemeClaim({
      id: row.id,
      tenantId: row.tenant_id,
      claimCode: row.claim_code,
      schemeId: row.scheme_id,
      distributorId: row.distributor_id,
      claimAmountCents: Number(row.claim_amount_cents),
      approvedAmountCents: Number(row.approved_amount_cents),
      status: row.status as SchemeClaimStatus,
      version: Number(row.version),
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    });
  }
}
