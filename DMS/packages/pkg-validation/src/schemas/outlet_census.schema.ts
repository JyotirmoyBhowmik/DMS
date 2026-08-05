import { z } from 'zod';

const GeoPointSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

export const CreateOutletCensusSchema = z.object({
  id: z.string().uuid().optional(),
  agentId: z.string().uuid(),
  outletId: z.string().uuid(),
  censusDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'Must be in YYYY-MM-DD format' }),
  outletName: z.string().min(1, { message: 'Outlet name is required' }),
  outletType: z.enum(['kirana', 'supermarket', 'pharmacy', 'general']),
  ownerName: z.string().min(1, { message: 'Owner name is required' }),
  ownerPhone: z.string().min(10).max(15, { message: 'Phone must be between 10 and 15 digits' }),
  address: z.string().min(1, { message: 'Address is required' }),
  geoCoords: GeoPointSchema,
  photoUrls: z.array(z.string().url()).optional(),
  gstin: z.string().regex(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/, { message: 'Invalid GSTIN format' }).nullable().optional(),
  panNumber: z.string().regex(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, { message: 'Invalid PAN format' }).nullable().optional(),
  tradeCategory: z.string().min(1, { message: 'Trade category is required' }),
  annualTurnoverEstimate: z.number().nonnegative().optional(),
  competitorPresence: z.array(z.string()).optional(),
}).strict(); // reject unknown fields to limit mass-assignment

export const UpdateOutletCensusSchema = z.object({
  action: z.enum(['submit', 'verify', 'approve', 'reject', 'update_kyc', 'add_photo', 'update_competitors']),
  kycStatus: z.enum(['pending', 'verified', 'rejected']).optional(),
  gstin: z.string().regex(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/, { message: 'Invalid GSTIN format' }).optional(),
  panNumber: z.string().regex(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, { message: 'Invalid PAN format' }).optional(),
  photoUrl: z.string().url().optional(),
  competitors: z.array(z.string()).optional(),
  version: z.number().optional(),
}).strict();

export type CreateOutletCensusInput = z.infer<typeof CreateOutletCensusSchema>;
export type UpdateOutletCensusInput = z.infer<typeof UpdateOutletCensusSchema>;
