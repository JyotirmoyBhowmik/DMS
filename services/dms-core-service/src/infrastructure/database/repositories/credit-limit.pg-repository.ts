/**
 * Postgres Repository for CreditLimit.
 */
import { CreditLimit, CreditRating } from '../../../domain/entities/credit-limit.js';
import { CreditLimitRepository } from '../../../domain/repositories/credit-limit.repository.js';

export class CreditLimitPgRepository extends CreditLimitRepository {
  constructor(private pool: any) {
    super();
  }

  async save(cl: CreditLimit): Promise<void> {
    const data = cl.toJSON();
    await this.pool.query(
      `INSERT INTO credit_limits
        (id, tenant_id, distributor_id, credit_limit, utilized_amount,
         temporary_limit_increase, temporary_limit_expiry, last_review_date,
         next_review_date, credit_rating, payment_term_days, version)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       ON CONFLICT (id) DO UPDATE SET
         credit_limit = $4, utilized_amount = $5, temporary_limit_increase = $6,
         temporary_limit_expiry = $7, last_review_date = $8, next_review_date = $9,
         credit_rating = $10, payment_term_days = $11, version = $12`,
      [data.id, data.tenantId, data.distributorId, data.creditLimit, data.utilizedAmount,
       data.temporaryLimitIncrease, data.temporaryLimitExpiry ?? null,
       data.lastReviewDate ?? null, data.nextReviewDate ?? null,
       data.creditRating, data.paymentTermDays, data.version]
    );
  }

  async findById(tenantId: string, id: string): Promise<CreditLimit | null> {
    const result = await this.pool.query(
      `SELECT * FROM credit_limits WHERE tenant_id = $1 AND id = $2`,
      [tenantId, id]
    );
    return result.rows[0] ? this.toDomain(result.rows[0]) : null;
  }

  async findByDistributor(tenantId: string, distributorId: string): Promise<CreditLimit | null> {
    const result = await this.pool.query(
      `SELECT * FROM credit_limits WHERE tenant_id = $1 AND distributor_id = $2`,
      [tenantId, distributorId]
    );
    return result.rows[0] ? this.toDomain(result.rows[0]) : null;
  }

  async findByRating(tenantId: string, rating: CreditRating): Promise<CreditLimit[]> {
    const result = await this.pool.query(
      `SELECT * FROM credit_limits WHERE tenant_id = $1 AND credit_rating = $2`,
      [tenantId, rating]
    );
    return result.rows.map((r: any) => this.toDomain(r));
  }

  async findOnCreditHold(tenantId: string): Promise<CreditLimit[]> {
    // Utilization > 90% means on hold
    const result = await this.pool.query(
      `SELECT * FROM credit_limits
       WHERE tenant_id = $1
         AND credit_limit > 0
         AND (utilized_amount::numeric / (credit_limit + COALESCE(
           CASE WHEN temporary_limit_expiry > now() THEN temporary_limit_increase ELSE 0 END, 0
         ))::numeric) > 0.9`,
      [tenantId]
    );
    return result.rows.map((r: any) => this.toDomain(r));
  }

  async findDueForReview(tenantId: string): Promise<CreditLimit[]> {
    const result = await this.pool.query(
      `SELECT * FROM credit_limits WHERE tenant_id = $1 AND next_review_date <= CURRENT_DATE`,
      [tenantId]
    );
    return result.rows.map((r: any) => this.toDomain(r));
  }

  async findAll(tenantId: string): Promise<CreditLimit[]> {
    const result = await this.pool.query(
      `SELECT * FROM credit_limits WHERE tenant_id = $1 ORDER BY created_at`,
      [tenantId]
    );
    return result.rows.map((r: any) => this.toDomain(r));
  }

  async delete(tenantId: string, id: string): Promise<void> {
    await this.pool.query(
      `DELETE FROM credit_limits WHERE tenant_id = $1 AND id = $2`,
      [tenantId, id]
    );
  }

  private toDomain(row: any): CreditLimit {
    return new CreditLimit({
      id: row.id,
      tenantId: row.tenant_id,
      distributorId: row.distributor_id,
      creditLimit: Number(row.credit_limit),
      utilizedAmount: Number(row.utilized_amount),
      temporaryLimitIncrease: Number(row.temporary_limit_increase ?? 0),
      temporaryLimitExpiry: row.temporary_limit_expiry?.toISOString?.() ?? row.temporary_limit_expiry,
      lastReviewDate: row.last_review_date?.toISOString?.()?.split('T')[0] ?? row.last_review_date,
      nextReviewDate: row.next_review_date?.toISOString?.()?.split('T')[0] ?? row.next_review_date,
      creditRating: row.credit_rating,
      paymentTermDays: row.payment_term_days,
      version: row.version,
    });
  }
}
