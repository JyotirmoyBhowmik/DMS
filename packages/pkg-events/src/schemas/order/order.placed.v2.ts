import { z } from 'zod';

// ─── Order Placed V2 (adds discount + tax fields) ──────────────────────

export const OrderLineItemV2Schema = z.object({
  skuId: z.string().uuid(),
  productName: z.string().min(1),
  quantity: z.number().int().positive(),
  unitPrice: z.number().int().nonnegative(),
  discountAmount: z.number().int().nonnegative().default(0),
  taxAmount: z.number().int().nonnegative().default(0),
  totalPrice: z.number().int().nonnegative(),
  currency: z.string().length(3),
});

export const OrderPlacedV2Schema = z.object({
  orderId: z.string().uuid(),
  outletId: z.string().uuid(),
  distributorId: z.string().uuid(),
  agentId: z.string().uuid(),
  orderDate: z.string().datetime(),
  subtotal: z.number().int().nonnegative(),
  totalDiscount: z.number().int().nonnegative().default(0),
  totalTax: z.number().int().nonnegative().default(0),
  grandTotal: z.number().int().nonnegative(),
  currency: z.string().length(3),
  items: z.array(OrderLineItemV2Schema).min(1),
  notes: z.string().optional(),
  deliveryDate: z.string().datetime().optional(),
  paymentTerms: z.string().optional(),
  schemeIds: z.array(z.string().uuid()).optional(),
});

export interface OrderLineItemV2 extends z.infer<typeof OrderLineItemV2Schema> {}
export interface OrderPlacedV2Payload extends z.infer<typeof OrderPlacedV2Schema> {}
