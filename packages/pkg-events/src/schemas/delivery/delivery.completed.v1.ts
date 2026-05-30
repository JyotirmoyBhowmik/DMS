import { z } from 'zod';

export const DeliveryCompletedV1Schema = z.object({
  deliveryId: z.string().uuid(),
  orderId: z.string().uuid(),
  outletId: z.string().uuid(),
  distributorId: z.string().uuid(),
  deliveredBy: z.string().uuid(),
  deliveredAt: z.string().datetime(),
  receivedBy: z.string().min(1),
  proofOfDelivery: z.string().optional(),
  items: z.array(z.object({
    skuId: z.string().uuid(),
    orderedQuantity: z.number().int().positive(),
    deliveredQuantity: z.number().int().nonnegative(),
    shortageQuantity: z.number().int().nonnegative().default(0),
  })).min(1),
  location: z.object({
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
  }).optional(),
});

export interface DeliveryCompletedV1Payload extends z.infer<typeof DeliveryCompletedV1Schema> {}
