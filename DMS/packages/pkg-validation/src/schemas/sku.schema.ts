import { z } from 'zod';

export const SkuStatusEnum = z.enum(['ACTIVE', 'INACTIVE']);

export const CreateSkuSchema = z.object({
  code: z.string().min(2, { message: 'SKU code must be at least 2 characters' }).max(50),
  name: z.string().min(2, { message: 'SKU name must be at least 2 characters' }).max(255),
  productId: z.string().uuid().optional(),
  barcode: z.string().optional(),
  ean: z.string().optional(),
  unitPrice: z.number().int().min(0, { message: 'Unit price must be non-negative (cents/paise)' }).default(0),
});

export const UpdateSkuSchema = z.object({
  name: z.string().min(2).max(255).optional(),
  productId: z.string().uuid().optional(),
  barcode: z.string().optional(),
  ean: z.string().optional(),
  unitPrice: z.number().int().min(0).optional(),
  status: SkuStatusEnum.optional(),
  version: z.number().int().positive({ message: 'version is required for optimistic locking' }),
});

export const QuerySkuSchema = z.object({
  status: SkuStatusEnum.optional(),
  code: z.string().optional(),
  productId: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type CreateSkuDTO = z.infer<typeof CreateSkuSchema>;
export type UpdateSkuDTO = z.infer<typeof UpdateSkuSchema>;
export type QuerySkuDTO = z.infer<typeof QuerySkuSchema>;
