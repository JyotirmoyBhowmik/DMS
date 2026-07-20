import { z } from 'zod';

export const ShelfPhotoSchema = z.object({
  photoUrl: z.string().url().max(1024),
  category: z.string().min(1).max(100),
  timestamp: z.string().datetime().optional().default(() => new Date().toISOString()),
});

export const BrandShelfShareSchema = z.object({
  brand: z.string().min(1).max(100),
  percentage: z.number().min(0).max(100),
});

export const PricingAuditItemSchema = z.object({
  skuId: z.string().min(1).max(255),
  listedPrice: z.number().int().nonnegative(), // cents/paise
  actualPrice: z.number().int().nonnegative(), // cents/paise
});

export const CreateMerchandisingAuditSchema = z.object({
  id: z.string().uuid().optional(),
  tenantId: z.string().uuid().optional(),
  agentId: z.string().uuid(),
  outletId: z.string().uuid(),
  visitId: z.string().uuid().nullable().optional(),
  auditDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD format'),
  shelfPhotos: z.array(ShelfPhotoSchema).optional().default([]),
  planogramCompliance: z.number().min(0).max(100).optional().default(0),
  shelfShareByBrand: z.array(BrandShelfShareSchema).optional().default([]),
  outOfStockSkus: z.array(z.string().min(1)).optional().default([]),
  pricingAudit: z.array(PricingAuditItemSchema).optional().default([]),
  displayScore: z.number().min(0).max(100).optional().default(0),
  notes: z.string().max(2000).nullable().optional(),
  status: z.enum(['DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED']).optional().default('DRAFT'),
}).strict().refine((data) => {
  const total = data.shelfShareByBrand.reduce((sum, item) => sum + item.percentage, 0);
  return total <= 100;
}, {
  message: 'Total shelf share percentage cannot exceed 100%',
  path: ['shelfShareByBrand'],
});

export const UpdateMerchandisingAuditSchema = z.object({
  planogramCompliance: z.number().min(0).max(100).optional(),
  shelfPhotos: z.array(ShelfPhotoSchema).optional(),
  shelfShareByBrand: z.array(BrandShelfShareSchema).optional(),
  outOfStockSkus: z.array(z.string().min(1)).optional(),
  pricingAudit: z.array(PricingAuditItemSchema).optional(),
  displayScore: z.number().min(0).max(100).optional(),
  notes: z.string().max(2000).nullable().optional(),
  status: z.enum(['DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED']).optional(),
  rejectionReason: z.string().max(1000).optional(),
  version: z.number().int().nonnegative(),
}).strict().refine((data) => {
  if (data.shelfShareByBrand) {
    const total = data.shelfShareByBrand.reduce((sum, item) => sum + item.percentage, 0);
    return total <= 100;
  }
  return true;
}, {
  message: 'Total shelf share percentage cannot exceed 100%',
  path: ['shelfShareByBrand'],
}).refine((data) => {
  if (data.status === 'REJECTED') {
    return !!data.rejectionReason && data.rejectionReason.trim().length > 0;
  }
  return true;
}, {
  message: 'rejectionReason is required when status is REJECTED',
  path: ['rejectionReason'],
});

export const ListMerchandisingAuditsQuerySchema = z.object({
  page: z.number().int().positive().optional().default(1),
  pageSize: z.number().int().positive().max(100).optional().default(10),
  agentId: z.string().uuid().optional(),
  outletId: z.string().uuid().optional(),
  status: z.enum(['DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED']).optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
}).strict();

export type CreateMerchandisingAuditInput = z.infer<typeof CreateMerchandisingAuditSchema>;
export type UpdateMerchandisingAuditInput = z.infer<typeof UpdateMerchandisingAuditSchema>;
export type ListMerchandisingAuditsQueryInput = z.infer<typeof ListMerchandisingAuditsQuerySchema>;
