import { z } from 'zod';

export const SettlementStatusEnum = z.enum([
  'INITIATED',
  'PROCESSING',
  'SETTLED',
  'FAILED',
  'CANCELLED',
]);

export const CreateSettlementSchema = z.object({
  id: z.string().uuid().optional(),
  settlementCode: z.string().min(1, 'settlementCode is required').max(100),
  claimId: z.string().uuid('claimId must be a valid UUID'),
  distributorId: z.string().uuid('distributorId must be a valid UUID'),
  amountCents: z.number().int().min(0, 'amountCents must be >= 0'),
  paymentReference: z.string().max(255).optional(),
  status: SettlementStatusEnum.optional().default('INITIATED'),
}).strict();

export const UpdateSettlementSchema = z.object({
  paymentReference: z.string().max(255).optional(),
  status: SettlementStatusEnum.optional(),
  version: z.number().int().positive('version is required for optimistic locking'),
}).strict();

export const QuerySettlementSchema = z.object({
  status: SettlementStatusEnum.optional(),
  claimId: z.string().uuid().optional(),
  distributorId: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type CreateSettlementInput = z.infer<typeof CreateSettlementSchema>;
export type UpdateSettlementInput = z.infer<typeof UpdateSettlementSchema>;
export type QuerySettlementInput = z.infer<typeof QuerySettlementSchema>;
