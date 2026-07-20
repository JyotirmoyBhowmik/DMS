import { z } from 'zod';

export const CreatePhotoCaptureSchema = z.object({
  id: z.string().uuid().optional(),
  tenantId: z.string().uuid().optional(),
  agentId: z.string().uuid(),
  outletId: z.string().uuid(),
  captureDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD format'),
  photoUrl: z.string().url().max(1024),
  tags: z.array(z.string().min(1)).optional().default([]),
  notes: z.string().max(2000).nullable().optional(),
  status: z.enum(['DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED']).optional().default('DRAFT'),
}).strict();

export const UpdatePhotoCaptureSchema = z.object({
  photoUrl: z.string().url().max(1024).optional(),
  tags: z.array(z.string().min(1)).optional(),
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

export const ListPhotoCapturesQuerySchema = z.object({
  page: z.number().int().positive().optional().default(1),
  pageSize: z.number().int().positive().max(100).optional().default(10),
  agentId: z.string().uuid().optional(),
  outletId: z.string().uuid().optional(),
  status: z.enum(['DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED']).optional(),
  tag: z.string().optional(),
}).strict();

export type CreatePhotoCaptureInput = z.infer<typeof CreatePhotoCaptureSchema>;
export type UpdatePhotoCaptureInput = z.infer<typeof UpdatePhotoCaptureSchema>;
export type ListPhotoCapturesQueryInput = z.infer<typeof ListPhotoCapturesQuerySchema>;
