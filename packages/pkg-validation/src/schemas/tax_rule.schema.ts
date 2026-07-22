import { z } from 'zod';

export const TaxRuleStatusEnum = z.enum(['ACTIVE', 'INACTIVE']);
export const TaxCodeEnum = z.enum(['GST_5', 'GST_12', 'GST_18', 'GST_28', 'VAT_STANDARD', 'EXEMPT']);

export const CreateTaxRuleSchema = z.object({
  name: z.string().min(1, { message: 'name is required' }),
  taxCode: TaxCodeEnum,
  ratePercentage: z.number().min(0, { message: 'ratePercentage must be non-negative' }),
});

export const UpdateTaxRuleSchema = z.object({
  name: z.string().optional(),
  ratePercentage: z.number().min(0).optional(),
  status: TaxRuleStatusEnum.optional(),
  version: z.number().int().positive({ message: 'version is required for optimistic locking' }),
});

export const QueryTaxRuleSchema = z.object({
  status: TaxRuleStatusEnum.optional(),
  taxCode: TaxCodeEnum.optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type CreateTaxRuleDTO = z.input<typeof CreateTaxRuleSchema>;
export type UpdateTaxRuleDTO = z.input<typeof UpdateTaxRuleSchema>;
export type QueryTaxRuleDTO = z.input<typeof QueryTaxRuleSchema>;
