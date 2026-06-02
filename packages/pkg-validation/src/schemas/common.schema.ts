import { z } from 'zod';

export const TenantIdSchema = z.string().uuid('TenantId must be a valid UUID');

export const MoneySchema = z.object({
  amount: z.number().nonnegative('Amount must be non-negative'),
  currency: z.string().length(3, 'Currency must be a 3-character ISO code').default('INR'),
});

export const GeoPointSchema = z.object({
  latitude: z.number().min(-90, 'Latitude must be between -90 and 90').max(90, 'Latitude must be between -90 and 90'),
  longitude: z.number().min(-180, 'Longitude must be between -180 and 180').max(180, 'Longitude must be between -180 and 180'),
});

export type TenantIdInput = z.infer<typeof TenantIdSchema>;
export type MoneyInput = z.infer<typeof MoneySchema>;
export type GeoPointInput = z.infer<typeof GeoPointSchema>;
