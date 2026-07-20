import { z } from 'zod';

export const CreateSurveyInputSchema = z.object({
  id: z.string().uuid().optional(),
  agentId: z.string().uuid({ message: 'Agent ID must be a valid UUID' }),
  outletId: z.string().uuid({ message: 'Outlet ID must be a valid UUID' }),
  title: z.string().min(1, 'Survey title cannot be empty').max(255, 'Survey title cannot exceed 255 characters'),
  description: z.string().optional(),
  status: z.enum(['DRAFT', 'ACTIVE', 'COMPLETED', 'CANCELLED']).optional(),
}).strict();

export const UpdateSurveyInputSchema = z.object({
  title: z.string().min(1, 'Survey title cannot be empty').max(255, 'Survey title cannot exceed 255 characters').optional(),
  description: z.string().optional(),
  status: z.enum(['DRAFT', 'ACTIVE', 'COMPLETED', 'CANCELLED']).optional(),
  version: z.number().int().min(1, 'Version must be at least 1'),
}).strict();

export const ListSurveysQuerySchema = z.object({
  agentId: z.string().uuid().optional(),
  outletId: z.string().uuid().optional(),
  status: z.enum(['DRAFT', 'ACTIVE', 'COMPLETED', 'CANCELLED']).optional(),
  page: z.number().int().min(1).optional(),
  pageSize: z.number().int().min(1).max(100).optional(),
}).strict();
