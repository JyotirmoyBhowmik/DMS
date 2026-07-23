import { z } from 'zod';

export const SchemeBudgetStatusEnum = z.enum(['ACTIVE', 'EXHAUSTED', 'FROZEN', 'CLOSED']);

export const CreateSchemeBudgetSchema = z.object({
  name: z.string().min(1, { message: 'name is required' }),
  budgetCode: z.string().min(1, { message: 'budgetCode is required' }),
  schemeId: z.string().min(1, { message: 'schemeId is required' }),
  totalAllocatedCents: z.number().int().min(0, { message: 'totalAllocatedCents must be non-negative' }),
  utilizedCents: z.number().int().min(0).default(0),
});

export const UpdateSchemeBudgetSchema = z.object({
  name: z.string().optional(),
  totalAllocatedCents: z.number().int().min(0).optional(),
  utilizedCents: z.number().int().min(0).optional(),
  status: SchemeBudgetStatusEnum.optional(),
  version: z.number().int().positive({ message: 'version is required for optimistic locking' }),
});

export const QuerySchemeBudgetSchema = z.object({
  status: SchemeBudgetStatusEnum.optional(),
  schemeId: z.string().optional(),
  budgetCode: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type CreateSchemeBudgetDTO = z.input<typeof CreateSchemeBudgetSchema>;
export type UpdateSchemeBudgetDTO = z.input<typeof UpdateSchemeBudgetSchema>;
export type QuerySchemeBudgetDTO = z.input<typeof QuerySchemeBudgetSchema>;
