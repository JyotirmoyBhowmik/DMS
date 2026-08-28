import {
  TenantStatus,
  PlanTier,
  IsolationTier,
  ErpConfig,
  BrandingConfig,
} from '../../domain/entities/tenant.entity.js';

export interface CreateTenantDto {
  name: string;
  code: string;
  domain?: string;
  subdomain?: string;
  customDomain?: string;
  planTier?: PlanTier;
  isolationTier?: IsolationTier;
  region?: string;
  erpConfig?: ErpConfig;
  channelModules?: string[];
  branding?: BrandingConfig;
  adminEmail?: string;
  adminPassword?: string;
  idempotencyKey?: string;
}

export interface UpdateTenantDto {
  name?: string;
  domain?: string;
  subdomain?: string;
  customDomain?: string;
  planTier?: PlanTier;
  isolationTier?: IsolationTier;
  region?: string;
  erpConfig?: ErpConfig;
  channelModules?: string[];
  branding?: BrandingConfig;
  status?: TenantStatus;
  version: number;
}

export interface TenantResponseDto {
  id: string;
  tenantId: string;
  name: string;
  code: string;
  domain?: string;
  subdomain?: string;
  customDomain?: string;
  planTier: PlanTier;
  isolationTier: IsolationTier;
  region: string;
  erpConfig: ErpConfig;
  channelModules: string[];
  branding: BrandingConfig;
  status: TenantStatus;
  idempotencyKey?: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}
