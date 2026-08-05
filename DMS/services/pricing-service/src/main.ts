import { PricingController } from './presentation/rest/controllers/pricing.controller.js';
import { CorrelationContext } from '@dms/pkg-logger';
import { randomUUID } from 'crypto';

const controller = new PricingController();

const mockPriceListRequest = {
  name: 'Standard Wholesale Price List',
  description: 'Base wholesale prices with quantity slab discounts',
  effectiveFrom: new Date().toISOString(),
  assignments: [
    { assignmentType: 'channel', assignmentValue: 'RETAIL', priority: 10 }
  ]
};

const mockEntryRequest = {
  productId: '11111111-2222-3333-4444-555555555555',
  basePrice: 5000n, // $50.00 or 50.00 Rs in minor units
  mrp: 6000n,
  taxRuleKey: 'GST_18',
  roundingRule: 'HALF_UP',
  tiers: [
    { minQuantity: 10, discountPercentage: 10.0 } // 10% discount for qty >= 10
  ],
  actorId: 'system-bootstrap',
  reason: 'Initial load'
};

const mockHeaders = {
  'x-tenant-id': 'tenant-uuid-2222',
};

async function bootstrap() {
  await CorrelationContext.run({ correlationId: randomUUID(), tenantId: 'tenant-uuid-2222' }, async () => {
    process.stdout.write(`\n=== PRICING-SERVICE BOOTSTRAP ===\n`);

    // 1. Create a Price List
    const plRes = await controller.handlePostPriceList(mockPriceListRequest, mockHeaders);
    process.stdout.write(`\n📝 Price List Creation (status=${plRes.statusCode}):\n`);
    process.stdout.write(JSON.stringify(plRes.body, null, 2) + `\n`);

    if (plRes.body.success) {
      const priceListId = plRes.body.priceListId;

      // 2. Add an Entry
      const entryRes = await controller.handlePostEntry(priceListId, mockEntryRequest, mockHeaders);
      process.stdout.write(`\n📝 Price Entry Addition (status=${entryRes.statusCode}):\n`);
      process.stdout.write(`  Product: ${entryRes.body.entry.productId} | Base Price: ${entryRes.body.entry.basePrice} | Tax: ${entryRes.body.entry.taxRuleKey}\n`);

      // 3. Perform a Calculation (Quantity = 5, no discount -> base unit price = 5000)
      const calcRes1 = await controller.handleCalculatePrice({
        productId: mockEntryRequest.productId,
        quantity: 5,
        channel: 'RETAIL'
      }, mockHeaders);
      process.stdout.write(`\n📊 Calculation for Qty=5 (No Slab discount) (status=${calcRes1.statusCode}):\n`);
      process.stdout.write(`  Subtotal: ${calcRes1.body.subtotal} | Tax: ${calcRes1.body.taxAmount} | Total: ${calcRes1.body.totalAmount}\n`);

      // 4. Perform a Calculation (Quantity = 12, 10% discount -> unit price = 4500)
      const calcRes2 = await controller.handleCalculatePrice({
        productId: mockEntryRequest.productId,
        quantity: 12,
        channel: 'RETAIL'
      }, mockHeaders);
      process.stdout.write(`\n📊 Calculation for Qty=12 (10% Slab discount) (status=${calcRes2.statusCode}):\n`);
      process.stdout.write(`  Subtotal: ${calcRes2.body.subtotal} | Tax: ${calcRes2.body.taxAmount} | Total: ${calcRes2.body.totalAmount}\n`);
    }

    process.stdout.write('\n=== PRICING-SERVICE BOOTSTRAP COMPLETE ===\n');
  });
}

bootstrap();
