import { z } from 'zod';

export const DiscountStatusEnum = z.enum(['DRAFT', 'ACTIVE', 'EXPIRED', 'ARCHIVED']);
export const DiscountTypeEnum = z.enum(['PERCENTAGE', 'FLAT_AMOUNT']);

export const CreateDiscountSchema = z.object({
  name: z.string().min(1, { message: 'name is required' }),
  code: z.string().min(1, { message: 'code is required' }),
  discountType: DiscountTypeEnum,
  value: z.number().positive({ message: 'value must be positive' }),
  minOrderAmountCents: z.number().int().min(0).default(0),
});

export const UpdateDiscountSchema = z.object({
  name: z.string().optional(),
  value: z.number().positive().optional(),
  minOrderAmountCents: z.number().int().min(0).optional(),
  status: DiscountStatusEnum.optional(),
  version: z.number().int().positive({ message: 'version is required for optimistic locking' }),
});

export const QueryDiscountSchema = z.object({
  status: DiscountStatusEnum.optional(),
  discountType: DiscountTypeEnum.optional(),
  code: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type CreateDiscountDTO = z.input<typeof CreateDiscountSchema>;
export type UpdateDiscountDTO = z.input<typeof UpdateDiscountSchema>;
export type QueryDiscountDTO = z.input<typeof QueryDiscountSchema>;
