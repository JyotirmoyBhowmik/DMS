import { z } from 'zod';

export const ClaimStatusEnum = z.enum(['SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'SETTLED']);

export const CreateClaimSchema = z.object({
  name: z.string().min(1, { message: 'name is required' }),
  claimCode: z.string().min(1, { message: 'claimCode is required' }),
  distributorId: z.string().min(1, { message: 'distributorId is required' }),
  schemeId: z.string().min(1, { message: 'schemeId is required' }),
  claimAmountCents: z.number().int().min(0, { message: 'claimAmountCents must be non-negative' }),
  approvedAmountCents: z.number().int().min(0).optional(),
});

export const UpdateClaimSchema = z.object({
  name: z.string().optional(),
  approvedAmountCents: z.number().int().min(0).optional(),
  status: ClaimStatusEnum.optional(),
  version: z.number().int().positive({ message: 'version is required for optimistic locking' }),
});

export const QueryClaimSchema = z.object({
  status: ClaimStatusEnum.optional(),
  distributorId: z.string().optional(),
  schemeId: z.string().optional(),
  claimCode: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type CreateClaimDTO = z.input<typeof CreateClaimSchema>;
export type UpdateClaimDTO = z.input<typeof UpdateClaimSchema>;
export type QueryClaimDTO = z.input<typeof QueryClaimSchema>;
