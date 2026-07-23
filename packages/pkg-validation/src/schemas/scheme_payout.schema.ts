import { z } from 'zod';

export const SchemePayoutStatusEnum = z.enum(['PENDING', 'APPROVED', 'DISBURSED', 'REJECTED']);
export const PayoutTypeEnum = z.enum(['CREDIT_NOTE', 'BANK_TRANSFER', 'CHEQUE']);

export const CreateSchemePayoutSchema = z.object({
  name: z.string().min(1, { message: 'name is required' }),
  payoutCode: z.string().min(1, { message: 'payoutCode is required' }),
  schemeId: z.string().min(1, { message: 'schemeId is required' }),
  distributorId: z.string().min(1, { message: 'distributorId is required' }),
  claimId: z.string().optional(),
  amountCents: z.number().int().min(0, { message: 'amountCents must be non-negative' }),
  payoutType: PayoutTypeEnum,
});

export const UpdateSchemePayoutSchema = z.object({
  name: z.string().optional(),
  amountCents: z.number().int().min(0).optional(),
  status: SchemePayoutStatusEnum.optional(),
  version: z.number().int().positive({ message: 'version is required for optimistic locking' }),
});

export const QuerySchemePayoutSchema = z.object({
  status: SchemePayoutStatusEnum.optional(),
  schemeId: z.string().optional(),
  distributorId: z.string().optional(),
  payoutCode: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type CreateSchemePayoutDTO = z.input<typeof CreateSchemePayoutSchema>;
export type UpdateSchemePayoutDTO = z.input<typeof UpdateSchemePayoutSchema>;
export type QuerySchemePayoutDTO = z.input<typeof QuerySchemePayoutSchema>;
