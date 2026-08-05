import { z } from 'zod';

export const ReturnStatusEnum = z.enum(['REQUESTED', 'APPROVED', 'INSPECTED', 'REFUNDED', 'REJECTED']);

export const CreateReturnSchema = z.object({
  returnNumber: z.string().min(1, { message: 'returnNumber is required' }),
  outletId: z.string().min(1, { message: 'outletId is required' }),
  warehouseId: z.string().min(1, { message: 'warehouseId is required' }),
  skuId: z.string().min(1, { message: 'skuId is required' }),
  quantity: z.number().int().positive({ message: 'quantity must be positive' }),
  reason: z.string().min(1, { message: 'reason is required' }),
  totalAmountCents: z.number().int().min(0, { message: 'totalAmountCents must be non-negative' }),
});

export const UpdateReturnSchema = z.object({
  status: ReturnStatusEnum.optional(),
  version: z.number().int().positive({ message: 'version is required for optimistic locking' }),
});

export const QueryReturnSchema = z.object({
  status: ReturnStatusEnum.optional(),
  outletId: z.string().optional(),
  warehouseId: z.string().optional(),
  skuId: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type CreateReturnDTO = z.input<typeof CreateReturnSchema>;
export type UpdateReturnDTO = z.input<typeof UpdateReturnSchema>;
export type QueryReturnDTO = z.input<typeof QueryReturnSchema>;
