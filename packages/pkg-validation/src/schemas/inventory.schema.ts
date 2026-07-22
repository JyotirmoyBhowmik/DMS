import { z } from 'zod';

export const InventoryStatusEnum = z.enum(['IN_STOCK', 'LOW_STOCK', 'OUT_OF_STOCK']);

export const CreateInventorySchema = z.object({
  warehouseId: z.string().min(1, { message: 'warehouseId is required' }),
  skuId: z.string().min(1, { message: 'skuId is required' }),
  quantityAvailable: z.number().int().min(0, { message: 'quantityAvailable must be non-negative' }).optional().default(0),
  quantityReserved: z.number().int().min(0, { message: 'quantityReserved must be non-negative' }).optional().default(0),
  reorderLevel: z.number().int().min(0, { message: 'reorderLevel must be non-negative' }).optional().default(10),
});

export const UpdateInventorySchema = z.object({
  quantityAvailable: z.number().int().min(0).optional(),
  quantityReserved: z.number().int().min(0).optional(),
  reorderLevel: z.number().int().min(0).optional(),
  version: z.number().int().positive({ message: 'version is required for optimistic locking' }),
});

export const QueryInventorySchema = z.object({
  status: InventoryStatusEnum.optional(),
  warehouseId: z.string().optional(),
  skuId: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type CreateInventoryDTO = z.input<typeof CreateInventorySchema>;
export type UpdateInventoryDTO = z.input<typeof UpdateInventorySchema>;
export type QueryInventoryDTO = z.input<typeof QueryInventorySchema>;
