import { z } from 'zod';

export const SchemePromotionStatusEnum = z.enum(['ACTIVE', 'PAUSED', 'EXPIRED', 'CANCELLED']);
export const PromotionTypeEnum = z.enum(['PERCENTAGE_DISCOUNT', 'FLAT_REBATE', 'FREE_GOODS']);

export const CreateSchemePromotionSchema = z.object({
  name: z.string().min(1, { message: 'name is required' }),
  promoCode: z.string().min(1, { message: 'promoCode is required' }),
  schemeId: z.string().min(1, { message: 'schemeId is required' }),
  promotionType: PromotionTypeEnum,
  discountPercentage: z.number().min(0).max(100).default(0),
  maxDiscountCents: z.number().int().min(0).default(0),
});

export const UpdateSchemePromotionSchema = z.object({
  name: z.string().optional(),
  discountPercentage: z.number().min(0).max(100).optional(),
  maxDiscountCents: z.number().int().min(0).optional(),
  status: SchemePromotionStatusEnum.optional(),
  version: z.number().int().positive({ message: 'version is required for optimistic locking' }),
});

export const QuerySchemePromotionSchema = z.object({
  status: SchemePromotionStatusEnum.optional(),
  schemeId: z.string().optional(),
  promoCode: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type CreateSchemePromotionDTO = z.input<typeof CreateSchemePromotionSchema>;
export type UpdateSchemePromotionDTO = z.input<typeof UpdateSchemePromotionSchema>;
export type QuerySchemePromotionDTO = z.input<typeof QuerySchemePromotionSchema>;
