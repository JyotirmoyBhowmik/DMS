import { z } from 'zod';

export const TransactionTypeEnum = z.enum(['RECEIPT', 'ISSUE', 'ADJUSTMENT', 'TRANSFER']);

export const CreateStockLedgerSchema = z.object({
  warehouseId: z.string().min(1, { message: 'warehouseId is required' }),
  skuId: z.string().min(1, { message: 'skuId is required' }),
  batchNumber: z.string().min(1, { message: 'batchNumber is required' }),
  transactionType: TransactionTypeEnum,
  quantity: z.number().int({ message: 'quantity must be an integer' }),
  referenceId: z.string().optional(),
});

export const UpdateStockLedgerSchema = z.object({
  quantity: z.number().int().optional(),
  referenceId: z.string().optional(),
  version: z.number().int().positive({ message: 'version is required for optimistic locking' }),
});

export const QueryStockLedgerSchema = z.object({
  transactionType: TransactionTypeEnum.optional(),
  warehouseId: z.string().optional(),
  skuId: z.string().optional(),
  batchNumber: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type CreateStockLedgerDTO = z.input<typeof CreateStockLedgerSchema>;
export type UpdateStockLedgerDTO = z.input<typeof UpdateStockLedgerSchema>;
export type QueryStockLedgerDTO = z.input<typeof QueryStockLedgerSchema>;
