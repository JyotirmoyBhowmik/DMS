import { z } from 'zod';

export const UpsertUserScopeSchema = z.object({
  userId: z.string().uuid(),
  orgType: z.enum(['CUSTOMER', 'DISTRIBUTOR', 'OUTLET', 'PLATFORM']).optional(),
  persona: z.enum([
    'customer_hq',
    'sales_marketing',
    'distributor_admin',
    'field_agent',
    'van_operator',
    'modern_trade',
    'small_shop',
  ]).optional(),
  distributorIds: z.array(z.string().uuid()).optional(),
  outletIds: z.array(z.string().uuid()).optional(),
  territoryIds: z.array(z.string()).optional(),
  moduleEntitlements: z.array(z.string()).optional(),
  syncProfile: z.enum(['field_full', 'van', 'shop_lite', 'hq_web']).optional(),
  dataClearance: z.enum(['PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'RESTRICTED']).optional(),
  erpConnectorId: z.string().uuid().optional(),
});

export type UpsertUserScopeDTO = z.infer<typeof UpsertUserScopeSchema>;
