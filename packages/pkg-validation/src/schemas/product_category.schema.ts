import { z } from 'zod';

export const ProductCategoryStatusEnum = z.enum(['ACTIVE', 'INACTIVE']);

export const CreateProductCategorySchema = z.object({
  code: z.string().min(2, { message: 'Category code must be at least 2 characters' }).max(50),
  name: z.string().min(2, { message: 'Category name must be at least 2 characters' }).max(255),
  parentCategoryId: z.string().optional(),
  description: z.string().optional(),
});

export const UpdateProductCategorySchema = z.object({
  name: z.string().min(2).max(255).optional(),
  parentCategoryId: z.string().optional(),
  description: z.string().optional(),
  status: ProductCategoryStatusEnum.optional(),
  version: z.number().int().positive({ message: 'version is required for optimistic locking' }),
});

export const QueryProductCategorySchema = z.object({
  status: ProductCategoryStatusEnum.optional(),
  code: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type CreateProductCategoryDTO = z.infer<typeof CreateProductCategorySchema>;
export type UpdateProductCategoryDTO = z.infer<typeof UpdateProductCategorySchema>;
export type QueryProductCategoryDTO = z.infer<typeof QueryProductCategorySchema>;
