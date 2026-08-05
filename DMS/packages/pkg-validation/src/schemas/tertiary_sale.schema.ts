import { z } from 'zod';

export const TertiarySaleStatusEnum = z.enum(['DRAFT', 'SUBMITTED', 'CONFIRMED', 'DISPATCHED', 'DELIVERED', 'CANCELLED']);

export const CreateTertiarySaleSchema = z.object({
  invoiceNumber: z.string().min(1, { message: 'invoiceNumber is required' }),
  consumerId: z.string().min(1, { message: 'consumerId is required' }),
  outletId: z.string().min(1, { message: 'outletId is required' }),
  skuId: z.string().min(1, { message: 'skuId is required' }),
  quantity: z.number().int().positive({ message: 'quantity must be positive' }),
  unitPriceCents: z.number().int().min(0, { message: 'unitPriceCents must be non-negative' }),
  totalAmountCents: z.number().int().min(0, { message: 'totalAmountCents must be non-negative' }),
});

export const UpdateTertiarySaleSchema = z.object({
  status: TertiarySaleStatusEnum.optional(),
  version: z.number().int().positive({ message: 'version is required for optimistic locking' }),
});

export const QueryTertiarySaleSchema = z.object({
  status: TertiarySaleStatusEnum.optional(),
  consumerId: z.string().optional(),
  outletId: z.string().optional(),
  skuId: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type CreateTertiarySaleDTO = z.input<typeof CreateTertiarySaleSchema>;
export type UpdateTertiarySaleDTO = z.input<typeof UpdateTertiarySaleSchema>;
export type QueryTertiarySaleDTO = z.input<typeof QueryTertiarySaleSchema>;
