import { z } from 'zod';

const GeoPointSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

export const CreateOutletProfileSchema = z.object({
  id: z.string().uuid().optional(),
  outletName: z.string().min(1, { message: 'Outlet name is required' }),
  outletType: z.enum(['kirana', 'supermarket', 'pharmacy', 'general']),
  ownerName: z.string().min(1, { message: 'Owner name is required' }),
  ownerPhone: z.string().min(10).max(15, { message: 'Phone must be between 10 and 15 digits' }),
  address: z.string().min(1, { message: 'Address is required' }),
  geoCoords: GeoPointSchema,
  kycStatus: z.enum(['pending', 'verified', 'rejected']).optional(),
  status: z.enum(['active', 'inactive']).optional(),
}).strict();

export const UpdateOutletProfileSchema = z.object({
  outletName: z.string().min(1).optional(),
  outletType: z.enum(['kirana', 'supermarket', 'pharmacy', 'general']).optional(),
  ownerName: z.string().min(1).optional(),
  ownerPhone: z.string().min(10).max(15).optional(),
  address: z.string().min(1).optional(),
  geoCoords: GeoPointSchema.optional(),
  kycStatus: z.enum(['pending', 'verified', 'rejected']).optional(),
  status: z.enum(['active', 'inactive']).optional(),
  version: z.number().optional(),
}).strict();

export type CreateOutletProfileInput = z.infer<typeof CreateOutletProfileSchema>;
export type UpdateOutletProfileInput = z.infer<typeof UpdateOutletProfileSchema>;
