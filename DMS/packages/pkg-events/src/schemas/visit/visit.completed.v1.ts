import { z } from 'zod';

export const VisitCompletedV1Schema = z.object({
  visitId: z.string().uuid(),
  agentId: z.string().uuid(),
  outletId: z.string().uuid(),
  journeyPlanId: z.string().uuid().optional(),
  checkInTime: z.string().datetime(),
  checkOutTime: z.string().datetime(),
  checkInLocation: z.object({
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
  }),
  checkOutLocation: z.object({
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
  }),
  distanceFromOutlet: z.number().nonnegative(),
  ordersPlaced: z.number().int().nonnegative(),
  photosUploaded: z.number().int().nonnegative().default(0),
  notes: z.string().optional(),
  visitOutcome: z.enum(['productive', 'non_productive', 'closed']),
});

export interface VisitCompletedV1Payload extends z.infer<typeof VisitCompletedV1Schema> {}
