import { z } from 'zod';

export const PlannedOutletSchema = z.object({
  outletId: z.string().uuid('outletId must be a valid UUID'),
  outletName: z.string().min(1, 'outletName is required'),
  sequence: z.number().int().nonnegative('sequence must be a non-negative integer'),
  latitude: z.number().min(-90).max(90, 'Latitude must be between -90 and 90'),
  longitude: z.number().min(-180).max(180, 'Longitude must be between -180 and 180'),
  estimatedArrival: z.string().datetime().or(z.date()),
  visited: z.boolean().default(false),
});

export const CreateJourneyPlanSchema = z.object({
  id: z.string().uuid().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  beatId: z.string().uuid('beatId must be a valid UUID'),
  beatName: z.string().min(1, 'beatName is required'),
  plannedOutlets: z.array(PlannedOutletSchema).min(1, 'Journey plan must contain at least one planned outlet'),
});

export type PlannedOutletInput = z.infer<typeof PlannedOutletSchema>;
export type CreateJourneyPlanInput = z.infer<typeof CreateJourneyPlanSchema>;
