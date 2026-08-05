/**
 * CreditLimit Repository Interface (Port).
 */
import { CreditLimit, CreditRating } from '../entities/credit-limit.js';

export abstract class CreditLimitRepository {
  abstract save(creditLimit: CreditLimit): Promise<void>;
  abstract findById(tenantId: string, id: string): Promise<CreditLimit | null>;
  abstract findByDistributor(tenantId: string, distributorId: string): Promise<CreditLimit | null>;
  abstract findByRating(tenantId: string, rating: CreditRating): Promise<CreditLimit[]>;
  abstract findOnCreditHold(tenantId: string): Promise<CreditLimit[]>;
  abstract findDueForReview(tenantId: string): Promise<CreditLimit[]>;
  abstract findAll(tenantId: string): Promise<CreditLimit[]>;
  abstract delete(tenantId: string, id: string): Promise<void>;
}
