import { z } from 'zod';

export const SchemeStatusEnum = z.enum(['DRAFT', 'ACTIVE', 'EXPIRED', 'SUSPENDED', 'ARCHIVED']);
export const SchemeTypeEnum = z.enum(['QUANTITY_DISCOUNT', 'VALUE_DISCOUNT', 'BUY_X_GET_Y', 'REBATE']);

export const CreateSchemeSchema = z.object({
  name: z.string().min(1, { message: 'name is required' }),
  code: z.string().min(1, { message: 'code is required' }),
  schemeType: SchemeTypeEnum,
  description: z.string().optional(),
});

export const UpdateSchemeSchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  status: SchemeStatusEnum.optional(),
  version: z.number().int().positive({ message: 'version is required for optimistic locking' }),
});

export const QuerySchemeSchema = z.object({
  status: SchemeStatusEnum.optional(),
  schemeType: SchemeTypeEnum.optional(),
  code: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type CreateSchemeDTO = z.input<typeof CreateSchemeSchema>;
export type UpdateSchemeDTO = z.input<typeof UpdateSchemeSchema>;
export type QuerySchemeDTO = z.input<typeof QuerySchemeSchema>;
