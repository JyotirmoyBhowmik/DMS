import { z } from 'zod';

export const CreateSalesTargetSchema = z.object({
  id: z.string().uuid().optional(),
  tenantId: z.string().uuid().optional(),
  agentId: z.string().uuid(),
  periodMonth: z.number().int().min(1).max(12),
  periodYear: z.number().int().min(2000).max(2100),
  targetAmount: z.number().nonnegative(),
  currency: z.string().min(3).max(3).optional().default('INR'),
  targetType: z.string().min(2).max(50),
  status: z.enum(['DRAFT', 'ACTIVE', 'COMPLETED', 'EXPIRED', 'CANCELLED']).optional().default('DRAFT'),
}).strict();

export const UpdateSalesTargetSchema = z.object({
  targetAmount: z.number().nonnegative().optional(),
  currency: z.string().min(3).max(3).optional(),
  status: z.enum(['DRAFT', 'ACTIVE', 'COMPLETED', 'EXPIRED', 'CANCELLED']).optional(),
  achievedAmount: z.number().nonnegative().optional(),
  version: z.number().int().nonnegative(),
}).strict();

export const ListSalesTargetsQuerySchema = z.object({
  page: z.number().int().positive().optional().default(1),
  pageSize: z.number().int().positive().max(100).optional().default(10),
  agentId: z.string().uuid().optional(),
  status: z.enum(['DRAFT', 'ACTIVE', 'COMPLETED', 'EXPIRED', 'CANCELLED']).optional(),
  targetType: z.string().optional(),
}).strict();

export type CreateSalesTargetInput = z.infer<typeof CreateSalesTargetSchema>;
export type UpdateSalesTargetInput = z.infer<typeof UpdateSalesTargetSchema>;
export type ListSalesTargetsQueryInput = z.infer<typeof ListSalesTargetsQuerySchema>;
