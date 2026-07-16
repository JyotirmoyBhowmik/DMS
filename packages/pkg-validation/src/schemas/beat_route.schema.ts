import { z } from 'zod';

export const BeatOutletInputSchema = z.object({
  outletId: z.string().uuid(),
  sequence: z.number().int().min(1),
  lat: z.number(),
  lng: z.number(),
});

export const CreateBeatRouteSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(3).max(100),
  region: z.string().min(2).max(100),
  assignedAgentIds: z.array(z.string().uuid()).optional(),
  frequency: z.enum(['daily', 'weekly', 'monthly']).optional(),
  outlets: z.array(BeatOutletInputSchema).optional(),
});

export const UpdateBeatRouteSchema = z.object({
  action: z.enum([
    'activate',
    'suspend',
    'archive',
    'assign_agent',
    'remove_agent',
    'add_outlet',
    'remove_outlet',
    'update_name',
    'update_frequency'
  ]),
  name: z.string().min(3).max(100).optional(),
  frequency: z.enum(['daily', 'weekly', 'monthly']).optional(),
  agentId: z.string().uuid().optional(),
  outletId: z.string().uuid().optional(),
  outlet: BeatOutletInputSchema.optional(),
});

export type CreateBeatRouteInput = z.infer<typeof CreateBeatRouteSchema>;
export type UpdateBeatRouteInput = z.infer<typeof UpdateBeatRouteSchema>;
export type BeatOutletInput = z.infer<typeof BeatOutletInputSchema>;
