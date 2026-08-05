import { z } from 'zod';

export const HierarchyLevelEnum = z.enum(['SUPER_STOCKIST', 'CNF', 'DISTRIBUTOR', 'SUB_DISTRIBUTOR']);

export const CreateDistributorHierarchySchema = z.object({
  parentDistributorId: z.string().uuid({ message: 'parentDistributorId must be a valid UUID' }),
  childDistributorId: z.string().uuid({ message: 'childDistributorId must be a valid UUID' }),
  hierarchyLevel: HierarchyLevelEnum,
  territory: z.string().min(1, { message: 'territory is required' }).max(255),
  effectiveFrom: z.string().min(1, { message: 'effectiveFrom is required' }),
  effectiveTo: z.string().optional(),
  isActive: z.boolean().optional(),
}).refine(data => data.parentDistributorId !== data.childDistributorId, {
  message: 'A distributor cannot be its own parent',
  path: ['childDistributorId'],
});

export const UpdateDistributorHierarchySchema = z.object({
  territory: z.string().min(1).max(255).optional(),
  effectiveFrom: z.string().min(1).optional(),
  effectiveTo: z.string().optional(),
  isActive: z.boolean().optional(),
  version: z.number().int().positive({ message: 'version is required for optimistic locking' }),
});

export const QueryDistributorHierarchySchema = z.object({
  parentDistributorId: z.string().uuid().optional(),
  childDistributorId: z.string().uuid().optional(),
  hierarchyLevel: HierarchyLevelEnum.optional(),
  territory: z.string().optional(),
  isActive: z.enum(['true', 'false']).transform(v => v === 'true').optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type CreateDistributorHierarchyDTO = z.infer<typeof CreateDistributorHierarchySchema>;
export type UpdateDistributorHierarchyDTO = z.infer<typeof UpdateDistributorHierarchySchema>;
export type QueryDistributorHierarchyDTO = z.infer<typeof QueryDistributorHierarchySchema>;
