/**
 * PriceList Repository Interface (Port).
 */
import { PriceList } from '../entities/price-list.js';

export abstract class PriceListRepository {
  abstract save(priceList: PriceList): Promise<void>;
  abstract findById(tenantId: string, id: string): Promise<PriceList | null>;
  abstract findByName(tenantId: string, name: string): Promise<PriceList | null>;
  abstract findActive(tenantId: string): Promise<PriceList[]>;
  abstract findEffective(tenantId: string, asOfDate?: string): Promise<PriceList[]>;
  abstract findAll(tenantId: string): Promise<PriceList[]>;
  abstract delete(tenantId: string, id: string): Promise<void>;
}
