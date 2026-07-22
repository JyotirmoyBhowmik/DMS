import { z } from 'zod';

export const StockTransferStatusEnum = z.enum(['REQUESTED', 'APPROVED', 'IN_TRANSIT', 'COMPLETED', 'CANCELLED']);

export const CreateStockTransferSchema = z.object({
  transferNumber: z.string().min(1, { message: 'transferNumber is required' }),
  sourceWarehouseId: z.string().min(1, { message: 'sourceWarehouseId is required' }),
  targetWarehouseId: z.string().min(1, { message: 'targetWarehouseId is required' }),
  skuId: z.string().min(1, { message: 'skuId is required' }),
  quantity: z.number().int().positive({ message: 'quantity must be positive' }),
}).refine(data => data.sourceWarehouseId !== data.targetWarehouseId, {
  message: 'sourceWarehouseId and targetWarehouseId cannot be identical',
  path: ['targetWarehouseId'],
});

export const UpdateStockTransferSchema = z.object({
  status: StockTransferStatusEnum.optional(),
  version: z.number().int().positive({ message: 'version is required for optimistic locking' }),
});

export const QueryStockTransferSchema = z.object({
  status: StockTransferStatusEnum.optional(),
  sourceWarehouseId: z.string().optional(),
  targetWarehouseId: z.string().optional(),
  skuId: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type CreateStockTransferDTO = z.input<typeof CreateStockTransferSchema>;
export type UpdateStockTransferDTO = z.input<typeof UpdateStockTransferSchema>;
export type QueryStockTransferDTO = z.input<typeof QueryStockTransferSchema>;
