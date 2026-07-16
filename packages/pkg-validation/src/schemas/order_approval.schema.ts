import { z } from 'zod';

export const CreateOrderApprovalSchema = z.object({
  id: z.string().uuid('id must be a valid UUID').optional(),
  orderId: z.string().uuid('orderId must be a valid UUID'),
  requestedBy: z.string().uuid('requestedBy must be a valid UUID'),
  amount: z.number().positive('amount must be positive'),
  thresholdAmount: z.number().nonnegative('thresholdAmount must be non-negative'),
});

export const UpdateOrderApprovalSchema = z.object({
  status: z.enum(['approved', 'rejected', 'escalated']),
  approvedBy: z.string().min(1, 'approvedBy is required').optional(),
  comments: z.string().max(500).optional(),
});

export type CreateOrderApprovalInput = z.infer<typeof CreateOrderApprovalSchema>;
export type UpdateOrderApprovalInput = z.infer<typeof UpdateOrderApprovalSchema>;
