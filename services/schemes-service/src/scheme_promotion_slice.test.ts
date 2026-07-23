import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert';
import { SchemePromotion } from './domain/entities/scheme_promotion.js';
import { SchemePromotionPgRepository } from './infrastructure/database/repositories/scheme_promotion.pg-repository.js';
import { CreateSchemePromotionUseCase } from './application/usecases/create-scheme-promotion.usecase.js';
import { GetSchemePromotionUseCase } from './application/usecases/get-scheme-promotion.usecase.js';
import { UpdateSchemePromotionUseCase } from './application/usecases/update-scheme-promotion.usecase.js';
import { ListSchemePromotionsUseCase } from './application/usecases/list-scheme-promotions.usecase.js';
import { Principal } from '@dms/pkg-rbac';
import { randomUUID } from 'node:crypto';

describe('SchemePromotion Full Vertical Slice Unit & Repo Tests', () => {
  const tenantId = '00000000-0000-0000-0000-000000000001';
  const principal: Principal = {
    id: 'admin-user-1',
    tenantId,
    roles: ['admin'],
  };

  const mockDb: any = {
    query: async () => ({ rows: [] }),
  };

  beforeEach(() => {
    SchemePromotionPgRepository.clearStore();
  });

  describe('SchemePromotion Domain Aggregate Invariants', () => {
    test('validates discountPercentage range and state machine transitions', () => {
      // Invalid percentage guard clause
      assert.throws(
        () => new SchemePromotion({
          id: randomUUID(),
          tenantId,
          schemeId: randomUUID(),
          name: 'Invalid Promo',
          promoCode: 'PROMO-INVALID',
          discountPercentage: 150,
        }),
        /discountPercentage must be between 0 and 100/
      );

      const promo = SchemePromotion.create({
        id: randomUUID(),
        tenantId,
        schemeId: randomUUID(),
        name: 'Summer Fest 15%',
        promoCode: 'PROMO-SUMMER-15',
        promotionType: 'PERCENTAGE_DISCOUNT',
        discountPercentage: 15,
        maxDiscountCents: 5000,
      });

      assert.strictEqual(promo.status, 'ACTIVE');

      // State transition: ACTIVE -> PAUSED -> EXPIRED -> CANCELLED
      promo.updateStatus('PAUSED');
      assert.strictEqual(promo.status, 'PAUSED');

      promo.updateStatus('EXPIRED');
      assert.strictEqual(promo.status, 'EXPIRED');

      promo.updateStatus('CANCELLED');
      assert.strictEqual(promo.status, 'CANCELLED');

      // Illegal transition after CANCELLED
      assert.throws(
        () => promo.updateStatus('ACTIVE'),
        /Cannot transition from final status/
      );
    });
  });

  describe('SchemePromotion Use Cases & Repository', () => {
    test('executes Create with idempotency key and enforces unique promo code per tenant', async () => {
      const repo = new SchemePromotionPgRepository(mockDb);
      const createUseCase = new CreateSchemePromotionUseCase(repo);
      const getUseCase = new GetSchemePromotionUseCase(repo);
      const updateUseCase = new UpdateSchemePromotionUseCase(repo);
      const listUseCase = new ListSchemePromotionsUseCase(repo);

      const dto = {
        name: 'Diwali Cashback 2026',
        promoCode: 'PROMO-DIWALI-500',
        schemeId: 'scheme-diwali-id',
        promotionType: 'FLAT_REBATE' as const,
        discountPercentage: 0,
        maxDiscountCents: 50000,
      };

      // Create initial
      const p1 = await createUseCase.execute(principal, dto, 'key-promo-101');
      assert.strictEqual(p1.promoCode, 'PROMO-DIWALI-500');

      // Idempotent retry
      const p2 = await createUseCase.execute(principal, dto, 'key-promo-101');
      assert.strictEqual(p2.id, p1.id);

      // Duplicate record error
      await assert.rejects(
        () => createUseCase.execute(principal, dto),
        /SchemePromotion with code PROMO-DIWALI-500 already exists/
      );

      // Get
      const fetched = await getUseCase.execute(principal, p1.id);
      assert.notStrictEqual(fetched, null);
      assert.strictEqual(fetched?.name, 'Diwali Cashback 2026');

      // List
      const list = await listUseCase.execute(principal, { promoCode: 'PROMO-DIWALI-500' });
      assert.strictEqual(list.total, 1);

      // Update status
      const updated = await updateUseCase.execute(principal, p1.id, {
        status: 'PAUSED',
        version: 1,
      });
      assert.strictEqual(updated.status, 'PAUSED');
      assert.strictEqual(updated.version, 2);
    });
  });
});
