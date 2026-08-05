import { Settlement, SettlementStatus } from '../../../domain/entities/settlement.js';

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

export interface ISettlementRepository {
  save(settlement: Settlement, tenantId: string): Promise<void>;
  findById(id: string, tenantId: string): Promise<Settlement | null>;
  findByCode(code: string, tenantId: string): Promise<Settlement | null>;
  update(settlement: Settlement, tenantId: string): Promise<Settlement>;
  list(
    tenantId: string,
    filters?: { status?: SettlementStatus; claimId?: string; distributorId?: string },
    pagination?: { page: number; limit: number }
  ): Promise<{ data: Settlement[]; total: number }>;
}

export class SettlementPgRepository implements ISettlementRepository {
  static inMemoryStore = new Map<string, Settlement>();

  static clearStore() {
    SettlementPgRepository.inMemoryStore.clear();
  }

  constructor(private db?: any) {}

  async save(settlement: Settlement, tenantId: string): Promise<void> {
    if (!this.db) {
      SettlementPgRepository.inMemoryStore.set(`${tenantId}:${settlement.id}`, settlement);
      return;
    }

    await this.db.query(
      `SET LOCAL app.current_tenant_id = $1;`,
      [tenantId]
    );

    const query = `
      INSERT INTO settlements (
        id, tenant_id, settlement_code, claim_id, distributor_id,
        amount_cents, payment_reference, status, version, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11);
    `;

    const values = [
      settlement.id,
      tenantId,
      settlement.settlementCode,
      settlement.claimId,
      settlement.distributorId,
      settlement.amountCents,
      settlement.paymentReference,
      settlement.status,
      settlement.version,
      settlement.createdAt,
      settlement.updatedAt,
    ];

    await this.db.query(query, values);
  }

  async findById(id: string, tenantId: string): Promise<Settlement | null> {
    if (!this.db) {
      const found = SettlementPgRepository.inMemoryStore.get(`${tenantId}:${id}`);
      return found || null;
    }

    const result = await this.db.query(
      `SELECT * FROM settlements WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId]
    );

    if (result.rows.length === 0) return null;
    return this.mapToEntity(result.rows[0]);
  }

  async findByCode(code: string, tenantId: string): Promise<Settlement | null> {
    if (!this.db) {
      for (const item of SettlementPgRepository.inMemoryStore.values()) {
        if (item.tenantId === tenantId && item.settlementCode === code) {
          return item;
        }
      }
      return null;
    }

    const result = await this.db.query(
      `SELECT * FROM settlements WHERE settlement_code = $1 AND tenant_id = $2`,
      [code, tenantId]
    );

    if (result.rows.length === 0) return null;
    return this.mapToEntity(result.rows[0]);
  }

  async update(settlement: Settlement, tenantId: string): Promise<Settlement> {
    if (!this.db) {
      const key = `${tenantId}:${settlement.id}`;
      const existing = SettlementPgRepository.inMemoryStore.get(key);
      if (!existing) throw new EntityNotFoundError('Settlement not found');
      if (existing.version !== settlement.version) {
        throw new ConcurrencyError('Version conflict: entity has been modified');
      }

      const updated = new Settlement({
        id: settlement.id,
        tenantId: settlement.tenantId,
        settlementCode: settlement.settlementCode,
        claimId: settlement.claimId,
        distributorId: settlement.distributorId,
        amountCents: settlement.amountCents,
        paymentReference: settlement.paymentReference,
        status: settlement.status,
        version: settlement.version + 1,
        createdAt: settlement.createdAt,
        updatedAt: new Date(),
      });

      SettlementPgRepository.inMemoryStore.set(key, updated);
      return updated;
    }

    const nextVersion = settlement.version + 1;
    const query = `
      UPDATE settlements SET
        payment_reference = $1,
        status = $2,
        version = $3,
        updated_at = NOW()
      WHERE id = $4 AND tenant_id = $5 AND version = $6
      RETURNING *;
    `;

    const result = await this.db.query(query, [
      settlement.paymentReference,
      settlement.status,
      nextVersion,
      settlement.id,
      tenantId,
      settlement.version,
    ]);

    if (result.rows.length === 0) {
      const existing = await this.findById(settlement.id, tenantId);
      if (!existing) throw new EntityNotFoundError('Settlement not found');
      throw new ConcurrencyError('Version conflict: entity has been modified');
    }

    return this.mapToEntity(result.rows[0]);
  }

  async list(
    tenantId: string,
    filters?: { status?: SettlementStatus; claimId?: string; distributorId?: string },
    pagination: { page: number; limit: number } = { page: 1, limit: 20 }
  ): Promise<{ data: Settlement[]; total: number }> {
    if (!this.db) {
      let all = Array.from(SettlementPgRepository.inMemoryStore.values()).filter(
        i => i.tenantId === tenantId
      );

      if (filters?.status) all = all.filter(i => i.status === filters.status);
      if (filters?.claimId) all = all.filter(i => i.claimId === filters.claimId);
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
    if (filters?.claimId) {
      whereClause += ` AND claim_id = $${paramIdx++}`;
      params.push(filters.claimId);
    }
    if (filters?.distributorId) {
      whereClause += ` AND distributor_id = $${paramIdx++}`;
      params.push(filters.distributorId);
    }

    const countRes = await this.db.query(
      `SELECT COUNT(*)::int as total FROM settlements ${whereClause}`,
      params
    );
    const total = countRes.rows[0]?.total || 0;

    const offset = (pagination.page - 1) * pagination.limit;
    params.push(pagination.limit, offset);
    const dataRes = await this.db.query(
      `SELECT * FROM settlements ${whereClause} ORDER BY created_at DESC LIMIT $${paramIdx++} OFFSET $${paramIdx++}`,
      params
    );

    return {
      data: dataRes.rows.map((row: any) => this.mapToEntity(row)),
      total,
    };
  }

  private mapToEntity(row: any): Settlement {
    return new Settlement({
      id: row.id,
      tenantId: row.tenant_id,
      settlementCode: row.settlement_code,
      claimId: row.claim_id,
      distributorId: row.distributor_id,
      amountCents: Number(row.amount_cents),
      paymentReference: row.payment_reference,
      status: row.status as SettlementStatus,
      version: Number(row.version),
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    });
  }
}
