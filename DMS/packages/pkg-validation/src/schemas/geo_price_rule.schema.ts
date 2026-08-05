import { z } from 'zod';

export const GeoPriceRuleStatusEnum = z.enum(['ACTIVE', 'INACTIVE']);

export const CreateGeoPriceRuleSchema = z.object({
  priceListId: z.string().min(1, { message: 'priceListId is required' }),
  regionCode: z.string().min(1, { message: 'regionCode is required' }),
  multiplier: z.number().positive({ message: 'multiplier must be positive' }).default(1.0),
  priceAdjustmentCents: z.number().int().default(0),
});

export const UpdateGeoPriceRuleSchema = z.object({
  multiplier: z.number().positive().optional(),
  priceAdjustmentCents: z.number().int().optional(),
  status: GeoPriceRuleStatusEnum.optional(),
  version: z.number().int().positive({ message: 'version is required for optimistic locking' }),
});

export const QueryGeoPriceRuleSchema = z.object({
  status: GeoPriceRuleStatusEnum.optional(),
  priceListId: z.string().optional(),
  regionCode: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type CreateGeoPriceRuleDTO = z.input<typeof CreateGeoPriceRuleSchema>;
export type UpdateGeoPriceRuleDTO = z.input<typeof UpdateGeoPriceRuleSchema>;
export type QueryGeoPriceRuleDTO = z.input<typeof QueryGeoPriceRuleSchema>;
