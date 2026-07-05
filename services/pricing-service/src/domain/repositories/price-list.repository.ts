import { PriceListEntity } from '../entities/price-list.entity.js';
import { PriceListAssignmentEntity } from '../entities/price-list-assignment.entity.js';
import { PriceListEntryEntity } from '../entities/price-list-entry.entity.js';
import { TaxRuleEntity } from '../entities/tax-rule.entity.js';
import { PaginatedResult, FindAllOptions } from '@dms/pkg-database';

export interface IPriceListRepository {
  save(priceList: PriceListEntity, tenantId: string): Promise<PriceListEntity>;
  findById(id: string, tenantId: string): Promise<PriceListEntity>;
  update(priceList: PriceListEntity, tenantId: string): Promise<PriceListEntity>;
  findAll(tenantId: string, options?: FindAllOptions): Promise<PaginatedResult<PriceListEntity>>;
  delete(id: string, tenantId: string): Promise<boolean>;

  // Assignment management
  saveAssignment(assignment: PriceListAssignmentEntity, tenantId: string): Promise<PriceListAssignmentEntity>;
  findAssignmentsForPriceList(priceListId: string, tenantId: string): Promise<PriceListAssignmentEntity[]>;
  deleteAssignment(id: string, tenantId: string): Promise<boolean>;

  // Entry management
  saveEntry(entry: PriceListEntryEntity, tenantId: string): Promise<PriceListEntryEntity>;
  findEntriesForPriceList(priceListId: string, tenantId: string): Promise<PriceListEntryEntity[]>;
  deleteEntry(id: string, tenantId: string): Promise<boolean>;

  // Resolving price list for customer/channel
  findEffectivePriceList(
    tenantId: string,
    customerId?: string,
    channel?: string,
    asOfDate?: Date
  ): Promise<PriceListEntity | null>;

  // Tax rules
  findTaxRule(tenantId: string, taxRuleKey: string): Promise<TaxRuleEntity | null>;
  saveTaxRule(taxRule: TaxRuleEntity, tenantId: string): Promise<TaxRuleEntity>;
  
  // Audit log
  saveAuditLog(log: {
    priceListId: string;
    productId: string;
    actorId: string;
    actionType: string;
    oldBasePrice?: bigint;
    newBasePrice?: bigint;
    oldMrp?: bigint;
    newMrp?: bigint;
    reason?: string;
  }, tenantId: string): Promise<void>;
}
