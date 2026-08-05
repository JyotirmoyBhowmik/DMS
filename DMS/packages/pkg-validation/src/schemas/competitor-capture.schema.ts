import { z } from 'zod';

export const CreateCompetitorCaptureSchema = z.object({
  id: z.string().uuid().optional(),
  tenantId: z.string().uuid().optional(),
  agentId: z.string().uuid(),
  outletId: z.string().uuid(),
  captureDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD format'),
  brand: z.string().min(1).max(200),
  skuId: z.string().min(1).max(100),
  observedPrice: z.number().int().nonnegative(), // cents
  observedPriceCurrency: z.string().min(3).max(3).optional().default('INR'),
  promotionDetails: z.string().max(2000).nullable().optional(),
  photoUrl: z.string().max(1024).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  status: z.enum(['DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED']).optional().default('DRAFT'),
}).strict();

export const UpdateCompetitorCaptureSchema = z.object({
  observedPrice: z.number().int().nonnegative().optional(),
  observedPriceCurrency: z.string().min(3).max(3).optional(),
  promotionDetails: z.string().max(2000).nullable().optional(),
  photoUrl: z.string().max(1024).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  status: z.enum(['DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED']).optional(),
  rejectionReason: z.string().max(1000).optional(),
  version: z.number().int().nonnegative(),
}).strict().refine((data) => {
  if (data.status === 'REJECTED') {
    return !!data.rejectionReason && data.rejectionReason.trim().length > 0;
  }
  return true;
}, {
  message: 'rejectionReason is required when status is REJECTED',
  path: ['rejectionReason'],
});

export const ListCompetitorCapturesQuerySchema = z.object({
  page: z.number().int().positive().optional().default(1),
  pageSize: z.number().int().positive().max(100).optional().default(10),
  agentId: z.string().uuid().optional(),
  outletId: z.string().uuid().optional(),
  status: z.enum(['DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED']).optional(),
  brand: z.string().optional(),
}).strict();

export type CreateCompetitorCaptureInput = z.infer<typeof CreateCompetitorCaptureSchema>;
export type UpdateCompetitorCaptureInput = z.infer<typeof UpdateCompetitorCaptureSchema>;
export type ListCompetitorCapturesQueryInput = z.infer<typeof ListCompetitorCapturesQuerySchema>;
