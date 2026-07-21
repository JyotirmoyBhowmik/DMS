import { z } from 'zod';

export const CreditRatingEnum = z.enum(['A', 'B', 'C', 'D']);

export const CreateCreditLimitSchema = z.object({
  distributorId: z.string().uuid({ message: 'distributorId must be a valid UUID' }),
  creditLimit: z.number().int().min(0, { message: 'creditLimit must be non-negative (cents/paise)' }),
  creditRating: CreditRatingEnum.optional(),
  paymentTermDays: z.number().int().positive().optional(),
});

export const UpdateCreditLimitSchema = z.object({
  creditLimit: z.number().int().min(0).optional(),
  creditRating: CreditRatingEnum.optional(),
  paymentTermDays: z.number().int().positive().optional(),
  temporaryLimitIncrease: z.number().int().min(0).optional(),
  temporaryLimitExpiry: z.string().optional(),
  version: z.number().int().positive({ message: 'version is required for optimistic locking' }),
});

export const UtilizeCreditSchema = z.object({
  amount: z.number().int().positive({ message: 'utilization amount must be positive' }),
  version: z.number().int().positive({ message: 'version is required for optimistic locking' }),
});

export const QueryCreditLimitSchema = z.object({
  distributorId: z.string().uuid().optional(),
  creditRating: CreditRatingEnum.optional(),
  onCreditHold: z.enum(['true', 'false']).transform(v => v === 'true').optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type CreateCreditLimitDTO = z.infer<typeof CreateCreditLimitSchema>;
export type UpdateCreditLimitDTO = z.infer<typeof UpdateCreditLimitSchema>;
export type UtilizeCreditDTO = z.infer<typeof UtilizeCreditSchema>;
export type QueryCreditLimitDTO = z.infer<typeof QueryCreditLimitSchema>;
