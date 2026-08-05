import { z } from 'zod';

export const OutletStatusEnum = z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED']);
export const OutletChannelEnum = z.enum(['RETAIL', 'WHOLESALE', 'KEY_ACCOUNT']);

export const CreateOutletSchema = z.object({
  name: z.string().min(2, { message: 'Outlet name must be at least 2 characters' }).max(255),
  latitude: z.number().min(-90).max(90, { message: 'Latitude must be between -90 and 90' }),
  longitude: z.number().min(-180).max(180, { message: 'Longitude must be between -180 and 180' }),
  radiusMeters: z.number().int().positive().optional(),
  channelType: OutletChannelEnum.optional(),
  address: z.string().optional(),
  ownerName: z.string().optional(),
  ownerPhone: z.string().optional(),
  distributorId: z.string().uuid().optional(),
});


export const UpdateOutletSchema = z.object({
  name: z.string().min(2).max(255).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  radiusMeters: z.number().int().positive().optional(),
  status: OutletStatusEnum.optional(),
  channelType: OutletChannelEnum.optional(),
  address: z.string().optional(),
  ownerName: z.string().optional(),
  ownerPhone: z.string().optional(),
  version: z.number().int().positive({ message: 'version is required for optimistic locking' }),
});

export const QueryOutletSchema = z.object({
  channelType: OutletChannelEnum.optional(),
  status: OutletStatusEnum.optional(),
  distributorId: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type CreateOutletDTO = z.infer<typeof CreateOutletSchema>;
export type UpdateOutletDTO = z.infer<typeof UpdateOutletSchema>;
export type QueryOutletDTO = z.infer<typeof QueryOutletSchema>;
