import { z } from 'zod';

export const ChannelPriceRuleStatusEnum = z.enum(['ACTIVE', 'INACTIVE']);
export const ChannelCodeEnum = z.enum(['GT', 'MT', 'ECOM', 'INSTITUTIONAL']);

export const CreateChannelPriceRuleSchema = z.object({
  priceListId: z.string().min(1, { message: 'priceListId is required' }),
  channelCode: ChannelCodeEnum,
  multiplier: z.number().positive({ message: 'multiplier must be positive' }).default(1.0),
  priceAdjustmentCents: z.number().int().default(0),
});

export const UpdateChannelPriceRuleSchema = z.object({
  multiplier: z.number().positive().optional(),
  priceAdjustmentCents: z.number().int().optional(),
  status: ChannelPriceRuleStatusEnum.optional(),
  version: z.number().int().positive({ message: 'version is required for optimistic locking' }),
});

export const QueryChannelPriceRuleSchema = z.object({
  status: ChannelPriceRuleStatusEnum.optional(),
  priceListId: z.string().optional(),
  channelCode: ChannelCodeEnum.optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type CreateChannelPriceRuleDTO = z.input<typeof CreateChannelPriceRuleSchema>;
export type UpdateChannelPriceRuleDTO = z.input<typeof UpdateChannelPriceRuleSchema>;
export type QueryChannelPriceRuleDTO = z.input<typeof QueryChannelPriceRuleSchema>;
