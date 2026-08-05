import { z } from 'zod';

export const ClaimReconciliationStatusEnum = z.enum([
  'DRAFT',
  'IN_PROGRESS',
  'RECONCILED',
  'DISCREPANCY_FLAGGED',
  'CLOSED',
]);

export const CreateClaimReconciliationSchema = z.object({
  id: z.string().uuid().optional(),
  reconciliationCode: z.string().min(1, 'reconciliationCode is required').max(100),
  distributorId: z.string().uuid('distributorId must be a valid UUID'),
  totalClaimedCents: z.number().int().min(0, 'totalClaimedCents must be >= 0'),
  totalSettledCents: z.number().int().min(0).optional().default(0),
  status: ClaimReconciliationStatusEnum.optional().default('DRAFT'),
}).strict();

export const UpdateClaimReconciliationSchema = z.object({
  totalSettledCents: z.number().int().min(0).optional(),
  status: ClaimReconciliationStatusEnum.optional(),
  version: z.number().int().positive('version is required for optimistic locking'),
}).strict();

export const QueryClaimReconciliationSchema = z.object({
  status: ClaimReconciliationStatusEnum.optional(),
  distributorId: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type CreateClaimReconciliationInput = z.infer<typeof CreateClaimReconciliationSchema>;
export type UpdateClaimReconciliationInput = z.infer<typeof UpdateClaimReconciliationSchema>;
export type QueryClaimReconciliationInput = z.infer<typeof QueryClaimReconciliationSchema>;
