import { z } from 'zod';

// ─── Order Placed V1 ────────────────────────────────────────────────────

export const OrderLineItemV1Schema = z.object({
  skuId: z.string().uuid(),
  productName: z.string().min(1),
  quantity: z.number().int().positive(),
  unitPrice: z.number().int().nonnegative(),
  totalPrice: z.number().int().nonnegative(),
  currency: z.string().length(3),
});

export const OrderPlacedV1Schema = z.object({
  orderId: z.string().uuid(),
  outletId: z.string().uuid(),
  distributorId: z.string().uuid(),
  agentId: z.string().uuid(),
  orderDate: z.string().datetime(),
  totalAmount: z.number().int().nonnegative(),
  currency: z.string().length(3),
  items: z.array(OrderLineItemV1Schema).min(1),
  notes: z.string().optional(),
  deliveryDate: z.string().datetime().optional(),
  paymentTerms: z.string().optional(),
});

export interface OrderLineItemV1 extends z.infer<typeof OrderLineItemV1Schema> {}
export interface OrderPlacedV1Payload extends z.infer<typeof OrderPlacedV1Schema> {}
