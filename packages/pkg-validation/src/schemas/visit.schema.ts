import { z } from 'zod';
import { GeoPointSchema } from './common.schema.js';

export const VisitTaskInputSchema = z.object({
  taskId: z.string().uuid(),
  taskType: z.string().min(2),
  notes: z.string().default(''),
});

export const CreateVisitSchema = z.object({
  id: z.string().uuid().optional(),
  outletId: z.string().uuid(),
  journeyPlanId: z.string().uuid(),
  plannedDate: z.string().datetime(),
});

export const UpdateVisitSchema = z.object({
  action: z.enum(['check_in', 'check_out', 'record_task', 'skip']),
  location: GeoPointSchema.optional(),
  task: VisitTaskInputSchema.optional(),
});

export type CreateVisitInput = z.infer<typeof CreateVisitSchema>;
export type UpdateVisitInput = z.infer<typeof UpdateVisitSchema>;
export type VisitTaskInput = z.infer<typeof VisitTaskInputSchema>;
