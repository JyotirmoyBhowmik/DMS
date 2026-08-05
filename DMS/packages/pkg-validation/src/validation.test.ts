import { test, describe } from 'node:test';
import assert from 'node:assert';
import {
  TenantIdSchema,
  MoneySchema,
  GeoPointSchema,
  OrderRules,
  ValidationError,
} from './index.js';

describe('Validation System Tests', () => {
  describe('Zod Primitives', () => {
    test('TenantIdSchema validation', () => {
      const valid = '00000000-0000-0000-0000-000000000001';
      const invalid = 'not-a-uuid';

      assert.strictEqual(TenantIdSchema.safeParse(valid).success, true);
      assert.strictEqual(TenantIdSchema.safeParse(invalid).success, false);
    });

    test('MoneySchema validation', () => {
      const valid = { amount: 150.50, currency: 'INR' };
      const invalidNegative = { amount: -5.00, currency: 'INR' };
      const invalidCurrency = { amount: 10.00, currency: 'USDT' }; // Length must be 3

      assert.strictEqual(MoneySchema.safeParse(valid).success, true);
      assert.strictEqual(MoneySchema.safeParse(invalidNegative).success, false);
      assert.strictEqual(MoneySchema.safeParse(invalidCurrency).success, false);
    });

    test('GeoPointSchema validation', () => {
      const valid = { latitude: 12.9716, longitude: 77.5946 };
      const invalidLat = { latitude: -91, longitude: 0 };
      const invalidLng = { latitude: 0, longitude: 181 };

      assert.strictEqual(GeoPointSchema.safeParse(valid).success, true);
      assert.strictEqual(GeoPointSchema.safeParse(invalidLat).success, false);
      assert.strictEqual(GeoPointSchema.safeParse(invalidLng).success, false);
    });
  });

  describe('OrderRules Business Validations', () => {
    test('validateCreditLimit success', () => {
      // 100 outstanding + 50 order <= 200 limit -> success
      assert.doesNotThrow(() => {
        OrderRules.validateCreditLimit(100, 50, 200);
      });
    });

    test('validateCreditLimit throws ValidationError on limit exceeded', () => {
      assert.throws(
        () => {
          OrderRules.validateCreditLimit(150, 100, 200);
        },
        (err: unknown) => {
          return (
            err instanceof ValidationError &&
            err.message === 'Credit limit exceeded' &&
            err.details[0]?.path === 'orderValue'
          );
        }
      );
    });

    test('validateJourneyWindow success', () => {
      // Mon June 1 2026 is Day 1 (Monday). 10:00 UTC is within allowed window 9-17 UTC.
      const time = new Date('2026-06-01T10:00:00Z');
      assert.doesNotThrow(() => {
        OrderRules.validateJourneyWindow(time, [1, 2, 3, 4, 5], 9, 17);
      });
    });

    test('validateJourneyWindow throws ValidationError on wrong day of week', () => {
      // Sun May 31 2026 is Day 0 (Sunday). Allowed: 1-5 (Mon-Fri)
      const time = new Date('2026-05-31T10:00:00Z');
      assert.throws(
        () => {
          OrderRules.validateJourneyWindow(time, [1, 2, 3, 4, 5], 9, 17);
        },
        (err: unknown) => {
          return (
            err instanceof ValidationError &&
            err.message === 'Outside allowed journey days' &&
            err.details[0]?.path === 'journeyWindow'
          );
        }
      );
    });

    test('validateJourneyWindow throws ValidationError on wrong hour of day', () => {
      // Mon June 1 2026, 18:00 UTC is outside allowed window 9-17 UTC.
      const time = new Date('2026-06-01T18:00:00Z');
      assert.throws(
        () => {
          OrderRules.validateJourneyWindow(time, [1, 2, 3, 4, 5], 9, 17);
        },
        (err: unknown) => {
          return (
            err instanceof ValidationError &&
            err.message === 'Outside allowed journey hours' &&
            err.details[0]?.path === 'journeyWindow'
          );
        }
      );
    });
  });
});
