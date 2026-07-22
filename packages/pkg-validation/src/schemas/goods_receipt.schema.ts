import { z } from 'zod';

export const GoodsReceiptStatusEnum = z.enum(['DRAFT', 'VERIFIED', 'POSTED', 'REJECTED']);

export const CreateGoodsReceiptSchema = z.object({
  receiptNumber: z.string().min(1, { message: 'receiptNumber is required' }),
  purchaseOrderId: z.string().min(1, { message: 'purchaseOrderId is required' }),
  warehouseId: z.string().min(1, { message: 'warehouseId is required' }),
  skuId: z.string().min(1, { message: 'skuId is required' }),
  receivedQuantity: z.number().int().positive({ message: 'receivedQuantity must be positive' }),
});

export const UpdateGoodsReceiptSchema = z.object({
  status: GoodsReceiptStatusEnum.optional(),
  version: z.number().int().positive({ message: 'version is required for optimistic locking' }),
});

export const QueryGoodsReceiptSchema = z.object({
  status: GoodsReceiptStatusEnum.optional(),
  purchaseOrderId: z.string().optional(),
  warehouseId: z.string().optional(),
  skuId: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type CreateGoodsReceiptDTO = z.input<typeof CreateGoodsReceiptSchema>;
export type UpdateGoodsReceiptDTO = z.input<typeof UpdateGoodsReceiptSchema>;
export type QueryGoodsReceiptDTO = z.input<typeof QueryGoodsReceiptSchema>;
