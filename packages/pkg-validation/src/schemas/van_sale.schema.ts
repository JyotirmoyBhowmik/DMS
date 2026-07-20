import { z } from 'zod';

const MoneySchema = z.object({
  amount: z.number().nonnegative(),
  currency: z.string().default('INR'),
});

const LoadedItemSchema = z.object({
  skuId: z.string().uuid(),
  qty: z.number().int().positive(),
  batchNumber: z.string().min(1),
});

const SoldItemSchema = z.object({
  skuId: z.string().uuid(),
  qty: z.number().int().positive(),
  unitPrice: z.number().int().nonnegative(), // unitPrice in cents/paise
  outletId: z.string().uuid(),
});

const ReturnedItemSchema = z.object({
  skuId: z.string().uuid(),
  qty: z.number().int().positive(),
  reason: z.string().min(1),
});

export const CreateVanSaleSchema = z.object({
  id: z.string().uuid().optional(),
  agentId: z.string().uuid(),
  vehicleId: z.string().uuid(),
  routeId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'Date must be in YYYY-MM-DD format' }),
  loadedItems: z.array(LoadedItemSchema).default([]),
}).strict();

export const UpdateVanSaleSchema = z.object({
  status: z.enum(['loading', 'in_transit', 'selling', 'reconciliation', 'closed']).optional(),
  loadedItems: z.array(LoadedItemSchema).optional(),
  soldItems: z.array(SoldItemSchema).optional(),
  returnedItems: z.array(ReturnedItemSchema).optional(),
  cashCollected: MoneySchema.optional(),
  digitalPayments: MoneySchema.optional(),
  version: z.number().int().nonnegative(),
}).strict();

export type CreateVanSaleInput = z.infer<typeof CreateVanSaleSchema>;
export type UpdateVanSaleInput = z.infer<typeof UpdateVanSaleSchema>;
