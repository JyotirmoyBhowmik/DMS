import { z } from 'zod';

export const PrimarySaleStatusEnum = z.enum(['DRAFT', 'SUBMITTED', 'CONFIRMED', 'DISPATCHED', 'DELIVERED', 'CANCELLED']);

export const CreatePrimarySaleSchema = z.object({
  invoiceNumber: z.string().min(1, { message: 'invoiceNumber is required' }),
  distributorId: z.string().min(1, { message: 'distributorId is required' }),
  warehouseId: z.string().min(1, { message: 'warehouseId is required' }),
  skuId: z.string().min(1, { message: 'skuId is required' }),
  quantity: z.number().int().positive({ message: 'quantity must be positive' }),
  unitPriceCents: z.number().int().min(0, { message: 'unitPriceCents must be non-negative' }),
  totalAmountCents: z.number().int().min(0, { message: 'totalAmountCents must be non-negative' }),
});

export const UpdatePrimarySaleSchema = z.object({
  status: PrimarySaleStatusEnum.optional(),
  version: z.number().int().positive({ message: 'version is required for optimistic locking' }),
});

export const QueryPrimarySaleSchema = z.object({
  status: PrimarySaleStatusEnum.optional(),
  distributorId: z.string().optional(),
  warehouseId: z.string().optional(),
  skuId: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type CreatePrimarySaleDTO = z.input<typeof CreatePrimarySaleSchema>;
export type UpdatePrimarySaleDTO = z.input<typeof UpdatePrimarySaleSchema>;
export type QueryPrimarySaleDTO = z.input<typeof QueryPrimarySaleSchema>;
