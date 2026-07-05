import { test, describe } from 'node:test';
import assert from 'node:assert';
import { PriceListEntity } from './domain/entities/price-list.entity.js';
import { PriceListEntryEntity } from './domain/entities/price-list-entry.entity.js';
import { PriceListAssignmentEntity } from './domain/entities/price-list-assignment.entity.js';
import { PricingAggregate } from './domain/aggregates/pricing.aggregate.js';
import { TaxRuleEntity } from './domain/entities/tax-rule.entity.js';
import { IPriceListRepository } from './domain/repositories/price-list.repository.js';
import { CreatePriceListUseCase } from './application/usecases/create_price_list.usecase.js';
import { UpdatePriceListUseCase } from './application/usecases/update_price_list.usecase.js';
import { AddPriceListEntryUseCase } from './application/usecases/add_price_list_entry.usecase.js';
import { CalculatePriceUseCase } from './application/usecases/calculate_price.usecase.js';

describe('Pricing Service - Unit Tests', () => {
  const tenantId = '00000000-0000-0000-0000-000000000001';
  const productId = '10000000-0000-0000-0000-000000000001';
  const priceListId = '20000000-0000-0000-0000-000000000002';

  describe('PricingAggregate - Business Logic & Invariants', () => {
    test('Should throw error if name is empty', () => {
      const pl = new PriceListEntity({ tenantId, name: '  ', effectiveFrom: new Date() });
      const agg = new PricingAggregate(pl);
      assert.throws(() => agg.validateInvariants(), /name must not be empty/);
    });

    test('Should throw error if effectiveFrom is after effectiveTo', () => {
      const pl = new PriceListEntity({
        tenantId,
        name: 'Standard List',
        effectiveFrom: new Date('2026-06-12'),
        effectiveTo: new Date('2026-06-10')
      });
      const agg = new PricingAggregate(pl);
      assert.throws(() => agg.validateInvariants(), /effectiveFrom must be before or equal to effectiveTo/);
    });

    test('Should calculate base price without discounts correctly', () => {
      const entry = new PriceListEntryEntity({
        productId,
        basePrice: 1000n, // $10.00 in cents
        mrp: 1200n,
        taxRuleKey: 'GST_18',
        roundingRule: 'HALF_UP'
      });
      const pl = new PriceListEntity({
        tenantId,
        name: 'Standard List',
        effectiveFrom: new Date(),
        entries: [entry]
      });

      const agg = new PricingAggregate(pl);
      const res = agg.calculatePrice(productId, 5, 18.0, 'HALF_UP');

      assert.strictEqual(res.baseUnitPrice, '1000');
      assert.strictEqual(res.discountedUnitPrice, '1000');
      assert.strictEqual(res.subtotal, '5000'); // 1000 * 5
      assert.strictEqual(res.taxAmount, '900'); // 18% of 5000 = 900
      assert.strictEqual(res.totalAmount, '5900');
    });

    test('Should apply percentage tier discounts correctly', () => {
      const entry = new PriceListEntryEntity({
        productId,
        basePrice: 1000n,
        mrp: 1200n,
        taxRuleKey: 'GST_18',
        roundingRule: 'HALF_UP',
        tiers: [
          { id: 't1', entryId: 'e1', minQuantity: 10, discountPercentage: 10.0 }, // 10% off for 10+
          { id: 't2', entryId: 'e1', minQuantity: 20, discountPercentage: 15.0 }  // 15% off for 20+
        ]
      });
      const pl = new PriceListEntity({
        tenantId,
        name: 'Wholesale List',
        effectiveFrom: new Date(),
        entries: [entry]
      });

      const agg = new PricingAggregate(pl);

      // Quantity = 5 (No discount)
      const resQty5 = agg.calculatePrice(productId, 5, 18.0);
      assert.strictEqual(resQty5.discountedUnitPrice, '1000');

      // Quantity = 12 (10% discount -> unit price = 900)
      const resQty12 = agg.calculatePrice(productId, 12, 18.0);
      assert.strictEqual(resQty12.discountedUnitPrice, '900');
      assert.strictEqual(resQty12.subtotal, '10800'); // 900 * 12

      // Quantity = 25 (15% discount -> unit price = 850)
      const resQty25 = agg.calculatePrice(productId, 25, 18.0);
      assert.strictEqual(resQty25.discountedUnitPrice, '850');
    });

    test('Should apply flat discount tiers correctly', () => {
      const entry = new PriceListEntryEntity({
        productId,
        basePrice: 1000n,
        mrp: 1200n,
        tiers: [
          { id: 't1', entryId: 'e1', minQuantity: 5, discountFlat: 150n } // $1.50 off for 5+
        ]
      });
      const pl = new PriceListEntity({
        tenantId,
        name: 'Flat Discount List',
        effectiveFrom: new Date(),
        entries: [entry]
      });

      const agg = new PricingAggregate(pl);
      const res = agg.calculatePrice(productId, 6, 18.0);
      assert.strictEqual(res.discountedUnitPrice, '850'); // 1000 - 150
      assert.strictEqual(res.subtotal, '5100'); // 850 * 6
    });

    test('Should respect rounding rules (HALF_UP, CEIL, FLOOR)', () => {
      const entry = new PriceListEntryEntity({
        productId,
        basePrice: 105n, // e.g. $1.05
        mrp: 150n,
      });
      const pl = new PriceListEntity({ tenantId, name: 'Rounding List', effectiveFrom: new Date(), entries: [entry] });
      const agg = new PricingAggregate(pl);

      // Subtotal = 105 * 1 = 105. Tax = 105 * 0.18 = 18.9

      // CEIL
      const resCeil = agg.calculatePrice(productId, 1, 18.0, 'CEIL');
      assert.strictEqual(resCeil.taxAmount, '19'); // Math.ceil(18.9) = 19

      // FLOOR
      const resFloor = agg.calculatePrice(productId, 1, 18.0, 'FLOOR');
      assert.strictEqual(resFloor.taxAmount, '18'); // Math.floor(18.9) = 18

      // HALF_UP
      const resHalfUp = agg.calculatePrice(productId, 1, 18.0, 'HALF_UP');
      assert.strictEqual(resHalfUp.taxAmount, '19'); // Math.round(18.9) = 19
    });
  });

  describe('Use Cases - In-Memory Tests', () => {
    class MockPriceListRepository implements IPriceListRepository {
      priceLists = new Map<string, PriceListEntity>();
      assignments = new Map<string, PriceListAssignmentEntity[]>();
      entries = new Map<string, PriceListEntryEntity[]>();
      auditLogs: any[] = [];

      async save(priceList: PriceListEntity, tenantId: string): Promise<PriceListEntity> {
        this.priceLists.set(priceList.id, priceList);
        return priceList;
      }
      async findById(id: string, tenantId: string): Promise<PriceListEntity> {
        const found = this.priceLists.get(id);
        if (!found) throw new Error('Not found');
        found.assignments = this.assignments.get(id) || [];
        found.entries = this.entries.get(id) || [];
        return found;
      }
      async update(priceList: PriceListEntity, tenantId: string): Promise<PriceListEntity> {
        this.priceLists.set(priceList.id, priceList);
        return priceList;
      }
      async findAll(): Promise<any> {
        return { data: Array.from(this.priceLists.values()) };
      }
      async delete(id: string): Promise<boolean> {
        return this.priceLists.delete(id);
      }
            async saveAssignment(assignment: PriceListAssignmentEntity, tenantId: string): Promise<PriceListAssignmentEntity> {
        const list = this.assignments.get(assignment.priceListId) || [];
        list.push(assignment);
        this.assignments.set(assignment.priceListId, list);
        return assignment;
      }
      async findAssignmentsForPriceList(priceListId: string, tenantId: string): Promise<PriceListAssignmentEntity[]> {
        return this.assignments.get(priceListId) || [];
      }
      async deleteAssignment(id: string, tenantId: string): Promise<boolean> {
        for (const [key, list] of this.assignments.entries()) {
          const filtered = list.filter(a => a.id !== id);
          this.assignments.set(key, filtered);
        }
        return true;
      }
      async saveEntry(entry: PriceListEntryEntity, tenantId: string): Promise<PriceListEntryEntity> {
        const list = this.entries.get(entry.priceListId) || [];
        const idx = list.findIndex(e => e.productId === entry.productId);
        if (idx >= 0) list[idx] = entry;
        else list.push(entry);
        this.entries.set(entry.priceListId, list);
        return entry;
      }
      async findEntriesForPriceList(priceListId: string, tenantId: string): Promise<PriceListEntryEntity[]> {
        return this.entries.get(priceListId) || [];
      }
      async deleteEntry(id: string, tenantId: string): Promise<boolean> {
        return true;
      }
      async findEffectivePriceList(
        tenantId: string,
        customerId?: string,
        channel?: string,
        asOfDate?: Date
      ): Promise<PriceListEntity | null> {
        // Simple mock matching logic
        for (const pl of this.priceLists.values()) {
          const plAssignments = this.assignments.get(pl.id) || [];
          for (const ass of plAssignments) {
            if (ass.assignmentType === 'customer' && ass.assignmentValue === customerId) {
              pl.entries = this.entries.get(pl.id) || [];
              return pl;
            }
            if (ass.assignmentType === 'channel' && ass.assignmentValue === channel) {
              pl.entries = this.entries.get(pl.id) || [];
              return pl;
            }
            if (ass.assignmentType === 'default') {
              pl.entries = this.entries.get(pl.id) || [];
              return pl;
            }
          }
        }
        return null;
      }
      async findTaxRule(tenantId: string, taxRuleKey: string): Promise<TaxRuleEntity> {
        return new TaxRuleEntity({ taxRuleKey, ratePercentage: 18.0 });
      }
      async saveTaxRule(taxRule: TaxRuleEntity, tenantId: string): Promise<TaxRuleEntity> {
        return taxRule;
      }
      async saveAuditLog(log: any, tenantId: string): Promise<void> {
        this.auditLogs.push(log);
      }

    }

    const mockDb = {
      transaction: async (cb: (conn: any) => Promise<any>) => {
        const mockConn = {
          query: async () => ({ rows: [] })
        };
        return cb(mockConn);
      }
    } as any;

    test('CreatePriceListUseCase execution flow', async () => {
      const repo = new MockPriceListRepository();
      const usecase = new CreatePriceListUseCase(mockDb, repo);

      const res = await usecase.execute(tenantId, {
        id: priceListId,
        name: 'Mock Price List',
        effectiveFrom: new Date(),
        assignments: [
          { assignmentType: 'default', priority: 0 }
        ]
      });

      assert.strictEqual(res.priceListId, priceListId);
      const saved = await repo.findById(priceListId, tenantId);
      assert.strictEqual(saved.name, 'Mock Price List');
    });

    test('AddPriceListEntryUseCase and CalculatePriceUseCase', async () => {
      const repo = new MockPriceListRepository();
      
      // Seed a price list
      const pl = new PriceListEntity({
        id: priceListId,
        tenantId,
        name: 'Distributor prices',
        effectiveFrom: new Date(),
      });
      await repo.save(pl, tenantId);
      await repo.saveAssignment(new PriceListAssignmentEntity({
        priceListId,
        assignmentType: 'channel',
        assignmentValue: 'DISTRIBUTOR',
        priority: 1
      }), tenantId);

      // Add entry
      const addUsecase = new AddPriceListEntryUseCase(mockDb, repo);
      await addUsecase.execute(tenantId, priceListId, {
        productId,
        basePrice: 5000n,
        mrp: 6000n,
        taxRuleKey: 'GST_18',
        actorId: 'admin-1',
        reason: 'Initial setup'
      });

      assert.strictEqual(repo.auditLogs.length, 1);
      assert.strictEqual(repo.auditLogs[0].actionType, 'CREATE_ENTRY');

      // Calculate price
      const calcUsecase = new CalculatePriceUseCase(undefined, repo);
      const pricing = await calcUsecase.execute(tenantId, {
        productId,
        quantity: 10,
        channel: 'DISTRIBUTOR'
      });

      assert.strictEqual(pricing.priceListId, priceListId);
      assert.strictEqual(pricing.baseUnitPrice, '5000');
      assert.strictEqual(pricing.subtotal, '50000'); // 5000 * 10
      assert.strictEqual(pricing.taxAmount, '9000'); // 18% of 50000 = 9000
      assert.strictEqual(pricing.totalAmount, '59000');
    });
  });
});
