import { z } from 'zod';

export const BatchStatusEnum = z.enum(['ACTIVE', 'EXPIRED', 'QUARANTINED', 'DEPLETED']);

export const CreateBatchSchema = z.object({
  batchNumber: z.string().min(1, { message: 'batchNumber is required' }),
  productId: z.string().min(1, { message: 'productId is required' }),
  warehouseId: z.string().min(1, { message: 'warehouseId is required' }),
  quantity: z.number().int().min(0, { message: 'quantity must be non-negative' }),
  expiryDate: z.string().min(1, { message: 'expiryDate is required' }),
});

export const UpdateBatchSchema = z.object({
  quantity: z.number().int().min(0).optional(),
  status: BatchStatusEnum.optional(),
  version: z.number().int().positive({ message: 'version is required for optimistic locking' }),
});

export const QueryBatchSchema = z.object({
  status: BatchStatusEnum.optional(),
  productId: z.string().optional(),
  warehouseId: z.string().optional(),
  batchNumber: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type CreateBatchDTO = z.input<typeof CreateBatchSchema>;
export type UpdateBatchDTO = z.input<typeof UpdateBatchSchema>;
export type QueryBatchDTO = z.input<typeof QueryBatchSchema>;
