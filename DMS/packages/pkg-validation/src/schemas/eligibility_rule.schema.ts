import { z } from 'zod';

export const EligibilityRuleStatusEnum = z.enum(['ACTIVE', 'INACTIVE']);
export const RuleTypeEnum = z.enum(['MIN_ORDER_VALUE', 'TARGET_CHANNEL', 'GEOGRAPHIC_ZONE', 'CUSTOMER_TIER']);

export const CreateEligibilityRuleSchema = z.object({
  name: z.string().min(1, { message: 'name is required' }),
  ruleCode: z.string().min(1, { message: 'ruleCode is required' }),
  schemeId: z.string().min(1, { message: 'schemeId is required' }),
  ruleType: RuleTypeEnum,
  minOrderValueCents: z.number().int().min(0).default(0),
  targetValue: z.string().optional(),
});

export const UpdateEligibilityRuleSchema = z.object({
  name: z.string().optional(),
  minOrderValueCents: z.number().int().min(0).optional(),
  targetValue: z.string().optional(),
  status: EligibilityRuleStatusEnum.optional(),
  version: z.number().int().positive({ message: 'version is required for optimistic locking' }),
});

export const QueryEligibilityRuleSchema = z.object({
  status: EligibilityRuleStatusEnum.optional(),
  schemeId: z.string().optional(),
  ruleCode: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type CreateEligibilityRuleDTO = z.input<typeof CreateEligibilityRuleSchema>;
export type UpdateEligibilityRuleDTO = z.input<typeof UpdateEligibilityRuleSchema>;
export type QueryEligibilityRuleDTO = z.input<typeof QueryEligibilityRuleSchema>;
