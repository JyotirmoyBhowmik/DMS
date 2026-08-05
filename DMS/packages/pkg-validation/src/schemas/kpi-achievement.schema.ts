import { z } from 'zod';

export const CreateKPIAchievementSchema = z.object({
  id: z.string().uuid().optional(),
  tenantId: z.string().uuid().optional(),
  agentId: z.string().uuid(),
  kpiType: z.string().min(2).max(50),
  periodMonth: z.number().int().min(1).max(12),
  periodYear: z.number().int().min(2000).max(2100),
  targetValue: z.number().nonnegative(),
  status: z.enum(['DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED']).optional().default('DRAFT'),
}).strict();

export const UpdateKPIAchievementSchema = z.object({
  targetValue: z.number().nonnegative().optional(),
  status: z.enum(['DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED']).optional(),
  achievedValue: z.number().nonnegative().optional(),
  version: z.number().int().nonnegative(),
}).strict();

export const ListKPIAchievementsQuerySchema = z.object({
  page: z.number().int().positive().optional().default(1),
  pageSize: z.number().int().positive().max(100).optional().default(10),
  agentId: z.string().uuid().optional(),
  status: z.enum(['DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED']).optional(),
  kpiType: z.string().optional(),
}).strict();

export type CreateKPIAchievementInput = z.infer<typeof CreateKPIAchievementSchema>;
export type UpdateKPIAchievementInput = z.infer<typeof UpdateKPIAchievementSchema>;
export type ListKPIAchievementsQueryInput = z.infer<typeof ListKPIAchievementsQuerySchema>;
