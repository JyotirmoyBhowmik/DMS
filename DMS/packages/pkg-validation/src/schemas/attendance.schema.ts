import { z } from 'zod';
import { GeoPointSchema } from './common.schema.js';

export const CreateAttendanceSchema = z.object({
  id: z.string().uuid().optional(),
  agentId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in format YYYY-MM-DD'),
  shiftStart: z.string().datetime().optional(),
  shiftEnd: z.string().datetime().optional(),
});

export const UpdateAttendanceSchema = z.object({
  action: z.enum(['check_in', 'check_out', 'approve', 'set_leave']),
  location: GeoPointSchema.optional(),
  leaveType: z.string().min(2).optional(),
});

export type CreateAttendanceInput = z.infer<typeof CreateAttendanceSchema>;
export type UpdateAttendanceInput = z.infer<typeof UpdateAttendanceSchema>;
