import { z } from 'zod';

export const SlabRewardStatusEnum = z.enum(['ACTIVE', 'INACTIVE']);
export const RewardTypeEnum = z.enum(['CASHBACK', 'FREE_PRODUCT', 'POINTS']);

export const CreateSlabRewardSchema = z.object({
  name: z.string().min(1, { message: 'name is required' }),
  slabCode: z.string().min(1, { message: 'slabCode is required' }),
  schemeId: z.string().min(1, { message: 'schemeId is required' }),
  minQualifyingQty: z.number().int().min(0).default(1),
  rewardType: RewardTypeEnum,
  rewardValueCents: z.number().int().min(0).default(0),
  rewardSkuId: z.string().optional(),
});

export const UpdateSlabRewardSchema = z.object({
  name: z.string().optional(),
  minQualifyingQty: z.number().int().min(0).optional(),
  rewardValueCents: z.number().int().min(0).optional(),
  rewardSkuId: z.string().optional(),
  status: SlabRewardStatusEnum.optional(),
  version: z.number().int().positive({ message: 'version is required for optimistic locking' }),
});

export const QuerySlabRewardSchema = z.object({
  status: SlabRewardStatusEnum.optional(),
  schemeId: z.string().optional(),
  slabCode: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type CreateSlabRewardDTO = z.input<typeof CreateSlabRewardSchema>;
export type UpdateSlabRewardDTO = z.input<typeof UpdateSlabRewardSchema>;
export type QuerySlabRewardDTO = z.input<typeof QuerySlabRewardSchema>;
