import { z } from 'zod';
import { GeoPointSchema } from './common.schema.js';

export const CreateDeliveryConfirmationSchema = z.object({
  id: z.string().uuid().optional(),
  tenantId: z.string().uuid().optional(),
  orderId: z.string().uuid(),
  deliveredAt: z.string().datetime({ message: 'deliveredAt must be a valid ISO 8601 date string' }),
  receivedBy: z.string().min(1, 'receivedBy is required').max(255),
  signaturePhotoUrl: z.string().max(1024).optional().or(z.literal('')),
  gpsLocation: GeoPointSchema,
  status: z.enum(['FULL', 'PARTIAL', 'REJECTED']),
  rejectionReason: z.string().max(1000).optional(),
}).strict().refine(data => {
  if (data.status === 'REJECTED') {
    return !!data.rejectionReason && data.rejectionReason.trim().length > 0;
  }
  return true;
}, {
  message: 'rejectionReason is required when status is REJECTED',
  path: ['rejectionReason']
});

export const UpdateDeliveryConfirmationSchema = z.object({
  status: z.enum(['FULL', 'PARTIAL', 'REJECTED']).optional(),
  receivedBy: z.string().min(1).max(255).optional(),
  signaturePhotoUrl: z.string().max(1024).optional().or(z.literal('')),
  rejectionReason: z.string().max(1000).optional(),
  version: z.number(),
}).strict().refine(data => {
  if (data.status === 'REJECTED') {
    return !!data.rejectionReason && data.rejectionReason.trim().length > 0;
  }
  return true;
}, {
  message: 'rejectionReason is required when status is REJECTED',
  path: ['rejectionReason']
});

export const ListDeliveryConfirmationsQuerySchema = z.object({
  page: z.number().int().positive().optional().default(1),
  pageSize: z.number().int().positive().max(100).optional().default(10),
  status: z.enum(['FULL', 'PARTIAL', 'REJECTED']).optional(),
  orderId: z.string().uuid().optional(),
}).strict();

export type CreateDeliveryConfirmationInput = z.infer<typeof CreateDeliveryConfirmationSchema>;
export type UpdateDeliveryConfirmationInput = z.infer<typeof UpdateDeliveryConfirmationSchema>;
export type ListDeliveryConfirmationsQueryInput = z.infer<typeof ListDeliveryConfirmationsQuerySchema>;
