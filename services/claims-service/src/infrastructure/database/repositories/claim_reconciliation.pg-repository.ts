import { ClaimReconciliation, ClaimReconciliationStatus } from '../../../domain/entities/claim_reconciliation.js';

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

export interface IClaimReconciliationRepository {
  save(reconciliation: ClaimReconciliation, tenantId: string): Promise<void>;
  findById(id: string, tenantId: string): Promise<ClaimReconciliation | null>;
  findByCode(code: string, tenantId: string): Promise<ClaimReconciliation | null>;
  update(reconciliation: ClaimReconciliation, tenantId: string): Promise<ClaimReconciliation>;
  list(
    tenantId: string,
    filters?: { status?: ClaimReconciliationStatus; distributorId?: string },
    pagination?: { page: number; limit: number }
  ): Promise<{ data: ClaimReconciliation[]; total: number }>;
}

export class ClaimReconciliationPgRepository implements IClaimReconciliationRepository {
  static inMemoryStore = new Map<string, ClaimReconciliation>();

  static clearStore() {
    ClaimReconciliationPgRepository.inMemoryStore.clear();
  }

  constructor(private db?: any) {}

  async save(reconciliation: ClaimReconciliation, tenantId: string): Promise<void> {
    if (!this.db) {
      ClaimReconciliationPgRepository.inMemoryStore.set(`${tenantId}:${reconciliation.id}`, reconciliation);
      return;
    }

    await this.db.query(
      `SET LOCAL app.current_tenant_id = $1;`,
      [tenantId]
    );

    const query = `
      INSERT INTO claim_reconciliations (
        id, tenant_id, reconciliation_code, distributor_id,
        total_claimed_cents, total_settled_cents, discrepancy_cents, status, version, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11);
    `;

    const values = [
      reconciliation.id,
      tenantId,
      reconciliation.reconciliationCode,
      reconciliation.distributorId,
      reconciliation.totalClaimedCents,
      reconciliation.totalSettledCents,
      reconciliation.discrepancyCents,
      reconciliation.status,
      reconciliation.version,
      reconciliation.createdAt,
      reconciliation.updatedAt,
    ];

    await this.db.query(query, values);
  }

  async findById(id: string, tenantId: string): Promise<ClaimReconciliation | null> {
    if (!this.db) {
      const found = ClaimReconciliationPgRepository.inMemoryStore.get(`${tenantId}:${id}`);
      return found || null;
    }

    const result = await this.db.query(
      `SELECT * FROM claim_reconciliations WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId]
    );

    if (result.rows.length === 0) return null;
    return this.mapToEntity(result.rows[0]);
  }

  async findByCode(code: string, tenantId: string): Promise<ClaimReconciliation | null> {
    if (!this.db) {
      for (const item of ClaimReconciliationPgRepository.inMemoryStore.values()) {
        if (item.tenantId === tenantId && item.reconciliationCode === code) {
          return item;
        }
      }
      return null;
    }

    const result = await this.db.query(
      `SELECT * FROM claim_reconciliations WHERE reconciliation_code = $1 AND tenant_id = $2`,
      [code, tenantId]
    );

    if (result.rows.length === 0) return null;
    return this.mapToEntity(result.rows[0]);
  }

  async update(reconciliation: ClaimReconciliation, tenantId: string): Promise<ClaimReconciliation> {
    if (!this.db) {
      const key = `${tenantId}:${reconciliation.id}`;
      const existing = ClaimReconciliationPgRepository.inMemoryStore.get(key);
      if (!existing) throw new EntityNotFoundError('ClaimReconciliation not found');
      if (existing.version !== reconciliation.version) {
        throw new ConcurrencyError('Version conflict: entity has been modified');
      }

      const updated = new ClaimReconciliation({
        id: reconciliation.id,
        tenantId: reconciliation.tenantId,
        reconciliationCode: reconciliation.reconciliationCode,
        distributorId: reconciliation.distributorId,
        totalClaimedCents: reconciliation.totalClaimedCents,
        totalSettledCents: reconciliation.totalSettledCents,
        discrepancyCents: reconciliation.discrepancyCents,
        status: reconciliation.status,
        version: reconciliation.version + 1,
        createdAt: reconciliation.createdAt,
        updatedAt: new Date(),
      });

      ClaimReconciliationPgRepository.inMemoryStore.set(key, updated);
      return updated;
    }

    const nextVersion = reconciliation.version + 1;
    const query = `
      UPDATE claim_reconciliations SET
        total_settled_cents = $1,
        discrepancy_cents = $2,
        status = $3,
        version = $4,
        updated_at = NOW()
      WHERE id = $5 AND tenant_id = $6 AND version = $7
      RETURNING *;
    `;

    const result = await this.db.query(query, [
      reconciliation.totalSettledCents,
      reconciliation.discrepancyCents,
      reconciliation.status,
      nextVersion,
      reconciliation.id,
      tenantId,
      reconciliation.version,
    ]);

    if (result.rows.length === 0) {
      const existing = await this.findById(reconciliation.id, tenantId);
      if (!existing) throw new EntityNotFoundError('ClaimReconciliation not found');
      throw new ConcurrencyError('Version conflict: entity has been modified');
    }

    return this.mapToEntity(result.rows[0]);
  }

  async list(
    tenantId: string,
    filters?: { status?: ClaimReconciliationStatus; distributorId?: string },
    pagination: { page: number; limit: number } = { page: 1, limit: 20 }
  ): Promise<{ data: ClaimReconciliation[]; total: number }> {
    if (!this.db) {
      let all = Array.from(ClaimReconciliationPgRepository.inMemoryStore.values()).filter(
        i => i.tenantId === tenantId
      );

      if (filters?.status) all = all.filter(i => i.status === filters.status);
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
    if (filters?.distributorId) {
      whereClause += ` AND distributor_id = $${paramIdx++}`;
      params.push(filters.distributorId);
    }

    const countRes = await this.db.query(
      `SELECT COUNT(*)::int as total FROM claim_reconciliations ${whereClause}`,
      params
    );
    const total = countRes.rows[0]?.total || 0;

    const offset = (pagination.page - 1) * pagination.limit;
    params.push(pagination.limit, offset);
    const dataRes = await this.db.query(
      `SELECT * FROM claim_reconciliations ${whereClause} ORDER BY created_at DESC LIMIT $${paramIdx++} OFFSET $${paramIdx++}`,
      params
    );

    return {
      data: dataRes.rows.map((row: any) => this.mapToEntity(row)),
      total,
    };
  }

  private mapToEntity(row: any): ClaimReconciliation {
    return new ClaimReconciliation({
      id: row.id,
      tenantId: row.tenant_id,
      reconciliationCode: row.reconciliation_code,
      distributorId: row.distributor_id,
      totalClaimedCents: Number(row.total_claimed_cents),
      totalSettledCents: Number(row.total_settled_cents),
      discrepancyCents: Number(row.discrepancy_cents),
      status: row.status as ClaimReconciliationStatus,
      version: Number(row.version),
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    });
  }
}
