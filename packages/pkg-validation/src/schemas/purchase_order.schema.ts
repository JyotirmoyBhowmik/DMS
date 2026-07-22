import { z } from 'zod';

export const PurchaseOrderStatusEnum = z.enum(['DRAFT', 'SUBMITTED', 'APPROVED', 'RECEIVED', 'CANCELLED']);

export const CreatePurchaseOrderSchema = z.object({
  poNumber: z.string().min(1, { message: 'poNumber is required' }),
  supplierId: z.string().min(1, { message: 'supplierId is required' }),
  warehouseId: z.string().min(1, { message: 'warehouseId is required' }),
  totalAmountCents: z.number().int().min(0, { message: 'totalAmountCents must be non-negative' }),
});

export const UpdatePurchaseOrderSchema = z.object({
  status: PurchaseOrderStatusEnum.optional(),
  totalAmountCents: z.number().int().min(0).optional(),
  version: z.number().int().positive({ message: 'version is required for optimistic locking' }),
});

export const QueryPurchaseOrderSchema = z.object({
  status: PurchaseOrderStatusEnum.optional(),
  supplierId: z.string().optional(),
  warehouseId: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type CreatePurchaseOrderDTO = z.input<typeof CreatePurchaseOrderSchema>;
export type UpdatePurchaseOrderDTO = z.input<typeof UpdatePurchaseOrderSchema>;
export type QueryPurchaseOrderDTO = z.input<typeof QueryPurchaseOrderSchema>;
