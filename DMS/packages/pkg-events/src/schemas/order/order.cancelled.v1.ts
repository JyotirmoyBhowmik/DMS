import { z } from 'zod';

export const OrderCancelledV1Schema = z.object({
  orderId: z.string().uuid(),
  outletId: z.string().uuid(),
  distributorId: z.string().uuid(),
  cancelledBy: z.string().uuid(),
  cancelledAt: z.string().datetime(),
  reason: z.string().min(1),
  refundAmount: z.number().int().nonnegative().optional(),
  currency: z.string().length(3).optional(),
});

export interface OrderCancelledV1Payload extends z.infer<typeof OrderCancelledV1Schema> {}
