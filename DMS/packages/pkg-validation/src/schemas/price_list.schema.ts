import { z } from 'zod';

export const PriceListStatusEnum = z.enum(['DRAFT', 'ACTIVE', 'INACTIVE', 'ARCHIVED']);

export const CreatePriceListSchema = z.object({
  name: z.string().min(1, { message: 'name is required' }),
  code: z.string().min(1, { message: 'code is required' }),
  currency: z.string().default('INR'),
  validFrom: z.string().optional(),
  validTo: z.string().optional(),
});

export const UpdatePriceListSchema = z.object({
  name: z.string().optional(),
  status: PriceListStatusEnum.optional(),
  validFrom: z.string().optional(),
  validTo: z.string().optional(),
  version: z.number().int().positive({ message: 'version is required for optimistic locking' }),
});

export const QueryPriceListSchema = z.object({
  status: PriceListStatusEnum.optional(),
  code: z.string().optional(),
  currency: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type CreatePriceListDTO = z.input<typeof CreatePriceListSchema>;
export type UpdatePriceListDTO = z.input<typeof UpdatePriceListSchema>;
export type QueryPriceListDTO = z.input<typeof QueryPriceListSchema>;
