import { z } from 'zod';

export const SecondarySaleStatusEnum = z.enum(['DRAFT', 'SUBMITTED', 'CONFIRMED', 'DISPATCHED', 'DELIVERED', 'CANCELLED']);

export const CreateSecondarySaleSchema = z.object({
  invoiceNumber: z.string().min(1, { message: 'invoiceNumber is required' }),
  outletId: z.string().min(1, { message: 'outletId is required' }),
  warehouseId: z.string().min(1, { message: 'warehouseId is required' }),
  skuId: z.string().min(1, { message: 'skuId is required' }),
  quantity: z.number().int().positive({ message: 'quantity must be positive' }),
  unitPriceCents: z.number().int().min(0, { message: 'unitPriceCents must be non-negative' }),
  totalAmountCents: z.number().int().min(0, { message: 'totalAmountCents must be non-negative' }),
});

export const UpdateSecondarySaleSchema = z.object({
  status: SecondarySaleStatusEnum.optional(),
  version: z.number().int().positive({ message: 'version is required for optimistic locking' }),
});

export const QuerySecondarySaleSchema = z.object({
  status: SecondarySaleStatusEnum.optional(),
  outletId: z.string().optional(),
  warehouseId: z.string().optional(),
  skuId: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type CreateSecondarySaleDTO = z.input<typeof CreateSecondarySaleSchema>;
export type UpdateSecondarySaleDTO = z.input<typeof UpdateSecondarySaleSchema>;
export type QuerySecondarySaleDTO = z.input<typeof QuerySecondarySaleSchema>;
