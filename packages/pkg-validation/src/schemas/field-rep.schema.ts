import { z } from 'zod';

export const CreateFieldRepInputSchema = z.object({
  id: z.string().uuid().optional(),
  userId: z.string().uuid(),
  employeeCode: z.string().min(1).max(32),
  firstName: z.string().min(1).max(128),
  lastName: z.string().min(1).max(128),
  email: z.string().email().max(256),
  phone: z.string().min(1).max(20),
  status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED', 'TERMINATED']).default('ACTIVE'),
});

export const UpdateFieldRepInputSchema = z.object({
  firstName: z.string().min(1).max(128).optional(),
  lastName: z.string().min(1).max(128).optional(),
  email: z.string().email().max(256).optional(),
  phone: z.string().min(1).max(20).optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED', 'TERMINATED']).optional(),
  version: z.number().int().nonnegative(),
});

export const ListFieldRepsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
  status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED', 'TERMINATED']).optional(),
  employeeCode: z.string().optional(),
  search: z.string().optional(),
});

export type CreateFieldRepInput = z.infer<typeof CreateFieldRepInputSchema>;
export type UpdateFieldRepInput = z.infer<typeof UpdateFieldRepInputSchema>;
export type ListFieldRepsQuery = z.infer<typeof ListFieldRepsQuerySchema>;
