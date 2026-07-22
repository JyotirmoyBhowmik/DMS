import { z } from 'zod';

export const ReplacementStatusEnum = z.enum(['REQUESTED', 'APPROVED', 'DISPATCHED', 'DELIVERED', 'REJECTED']);

export const CreateReplacementSchema = z.object({
  replacementNumber: z.string().min(1, { message: 'replacementNumber is required' }),
  returnId: z.string().min(1, { message: 'returnId is required' }),
  outletId: z.string().min(1, { message: 'outletId is required' }),
  warehouseId: z.string().min(1, { message: 'warehouseId is required' }),
  skuId: z.string().min(1, { message: 'skuId is required' }),
  quantity: z.number().int().positive({ message: 'quantity must be positive' }),
});

export const UpdateReplacementSchema = z.object({
  status: ReplacementStatusEnum.optional(),
  version: z.number().int().positive({ message: 'version is required for optimistic locking' }),
});

export const QueryReplacementSchema = z.object({
  status: ReplacementStatusEnum.optional(),
  returnId: z.string().optional(),
  outletId: z.string().optional(),
  warehouseId: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type CreateReplacementDTO = z.input<typeof CreateReplacementSchema>;
export type UpdateReplacementDTO = z.input<typeof UpdateReplacementSchema>;
export type QueryReplacementDTO = z.input<typeof QueryReplacementSchema>;
