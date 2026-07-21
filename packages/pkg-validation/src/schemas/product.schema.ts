import { z } from 'zod';

export const ProductStatusEnum = z.enum(['ACTIVE', 'DISCONTINUED']);

export const CreateProductSchema = z.object({
  sku: z.string().min(2, { message: 'SKU must be at least 2 characters' }).max(50),
  name: z.string().min(2, { message: 'Product name must be at least 2 characters' }).max(255),
  category: z.string().min(1, { message: 'Category is required' }),
  price: z.number().int().min(0, { message: 'Price must be non-negative (cents/paise)' }),
  minThreshold: z.number().int().min(0, { message: 'minThreshold must be non-negative' }).optional(),
  uom: z.string().optional(),
});


export const UpdateProductSchema = z.object({
  name: z.string().min(2).max(255).optional(),
  category: z.string().optional(),
  price: z.number().int().min(0).optional(),
  minThreshold: z.number().int().min(0).optional(),
  uom: z.string().optional(),
  status: ProductStatusEnum.optional(),
  version: z.number().int().positive({ message: 'version is required for optimistic locking' }),
});

export const QueryProductSchema = z.object({
  category: z.string().optional(),
  status: ProductStatusEnum.optional(),
  sku: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type CreateProductDTO = z.infer<typeof CreateProductSchema>;
export type UpdateProductDTO = z.infer<typeof UpdateProductSchema>;
export type QueryProductDTO = z.infer<typeof QueryProductSchema>;
