import { z } from 'zod';

export const OrderItemSchema = z.object({
  skuId: z.string().uuid('skuId must be a valid UUID'),
  quantity: z.number().int().positive('Quantity must be greater than zero'),
  price: z.number().positive('Price must be greater than zero'),
});

export const PlaceOrderSchema = z.object({
  id: z.string().uuid('id must be a valid UUID').optional(),
  outletId: z.string().uuid('outletId must be a valid UUID'),
  items: z.array(OrderItemSchema).min(1, 'Order must contain at least one item'),
  notes: z.string().optional(),
});

export type OrderItemInput = z.infer<typeof OrderItemSchema>;
export type PlaceOrderInput = z.infer<typeof PlaceOrderSchema>;
