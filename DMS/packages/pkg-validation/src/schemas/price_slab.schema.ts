import { z } from 'zod';

export const PriceSlabStatusEnum = z.enum(['ACTIVE', 'INACTIVE']);

export const CreatePriceSlabSchema = z.object({
  priceListId: z.string().min(1, { message: 'priceListId is required' }),
  skuId: z.string().min(1, { message: 'skuId is required' }),
  minQuantity: z.number().int().positive({ message: 'minQuantity must be positive' }),
  maxQuantity: z.number().int().positive({ message: 'maxQuantity must be positive' }),
  priceCents: z.number().int().min(0, { message: 'priceCents must be non-negative' }),
}).refine(data => data.maxQuantity >= data.minQuantity, {
  message: 'maxQuantity must be greater than or equal to minQuantity',
  path: ['maxQuantity'],
});

export const UpdatePriceSlabSchema = z.object({
  priceCents: z.number().int().min(0).optional(),
  status: PriceSlabStatusEnum.optional(),
  version: z.number().int().positive({ message: 'version is required for optimistic locking' }),
});

export const QueryPriceSlabSchema = z.object({
  status: PriceSlabStatusEnum.optional(),
  priceListId: z.string().optional(),
  skuId: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type CreatePriceSlabDTO = z.input<typeof CreatePriceSlabSchema>;
export type UpdatePriceSlabDTO = z.input<typeof UpdatePriceSlabSchema>;
export type QueryPriceSlabDTO = z.input<typeof QueryPriceSlabSchema>;
