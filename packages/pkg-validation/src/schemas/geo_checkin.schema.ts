import { z } from 'zod';
import { GeoPointSchema } from './common.schema.js';

export const CreateGeoCheckInSchema = z.object({
  id: z.string().uuid().optional(),
  agentId: z.string().uuid(),
  outletId: z.string().uuid(),
  visitId: z.string().uuid().optional(),
  checkInCoords: GeoPointSchema,
  outletCoords: GeoPointSchema,
  deviceInfo: z.object({
    model: z.string().min(1),
    os: z.string().min(1),
    batteryLevel: z.number().min(0).max(100),
  }),
  geofenceRadiusM: z.number().positive().optional(),
  spoofingDetected: z.boolean().optional(),
}).strict();

export const UpdateGeoCheckInSchema = z.object({
  action: z.enum(['check_out', 'flag_spoofing']),
  coords: GeoPointSchema.optional(),
}).strict();

export type CreateGeoCheckInInput = z.infer<typeof CreateGeoCheckInSchema>;
export type UpdateGeoCheckInInput = z.infer<typeof UpdateGeoCheckInSchema>;
