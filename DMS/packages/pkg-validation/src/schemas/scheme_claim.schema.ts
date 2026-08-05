import { z } from 'zod';

export const SchemeClaimStatusEnum = z.enum([
  'SUBMITTED',
  'UNDER_REVIEW',
  'APPROVED',
  'REJECTED',
  'SETTLED',
]);

export const CreateSchemeClaimSchema = z.object({
  id: z.string().uuid().optional(),
  claimCode: z.string().min(1, 'claimCode is required').max(100),
  schemeId: z.string().uuid('schemeId must be a valid UUID'),
  distributorId: z.string().uuid('distributorId must be a valid UUID'),
  claimAmountCents: z.number().int().min(0, 'claimAmountCents must be >= 0'),
  approvedAmountCents: z.number().int().min(0).optional().default(0),
  status: SchemeClaimStatusEnum.optional().default('SUBMITTED'),
}).strict();

export const UpdateSchemeClaimSchema = z.object({
  claimAmountCents: z.number().int().min(0).optional(),
  approvedAmountCents: z.number().int().min(0).optional(),
  status: SchemeClaimStatusEnum.optional(),
  version: z.number().int().positive('version is required for optimistic locking'),
}).strict();

export const QuerySchemeClaimSchema = z.object({
  status: SchemeClaimStatusEnum.optional(),
  schemeId: z.string().uuid().optional(),
  distributorId: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type CreateSchemeClaimInput = z.infer<typeof CreateSchemeClaimSchema>;
export type UpdateSchemeClaimInput = z.infer<typeof UpdateSchemeClaimSchema>;
export type QuerySchemeClaimInput = z.infer<typeof QuerySchemeClaimSchema>;
