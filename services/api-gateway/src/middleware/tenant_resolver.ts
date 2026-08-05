export interface ResolvedTenantContext {
  tenantId: string;
  subdomain?: string;
  customDomain?: string;
  planTier: 'FREE' | 'STARTER' | 'PROFESSIONAL' | 'ENTERPRISE';
  isolationTier: 'SHARED_RLS' | 'SCHEMA_PER_TENANT' | 'DEDICATED_CLUSTER';
  region: string;
  channelModules: string[];
}

export class TenantResolver {
  private static DEFAULT_TENANT_ID = '00000000-0000-0000-0000-000000000001';

  /**
   * Resolves tenant context from request headers, Host header, or JWT claims.
   */
  public static resolve(headers: Record<string, string | string[] | undefined>, query?: Record<string, string>): ResolvedTenantContext {
    const getHeader = (name: string): string | undefined => {
      const val = headers[name.toLowerCase()] || headers[name];
      if (Array.isArray(val)) return val[0];
      return val;
    };

    // 1. Direct X-Tenant-ID Header
    const directTenantId = getHeader('x-tenant-id');
    if (directTenantId && directTenantId.trim().length > 0) {
      return {
        tenantId: directTenantId.trim(),
        planTier: 'PROFESSIONAL',
        isolationTier: 'SHARED_RLS',
        region: 'singapore',
        channelModules: ['DMS_CORE', 'SFA', 'VAN_SALES', 'TRADE_SCHEMES'],
      };
    }

    // 2. Query param ?tenantId=...
    if (query?.tenantId) {
      return {
        tenantId: query.tenantId,
        planTier: 'PROFESSIONAL',
        isolationTier: 'SHARED_RLS',
        region: 'singapore',
        channelModules: ['DMS_CORE', 'SFA', 'VAN_SALES', 'TRADE_SCHEMES'],
      };
    }

    // 3. Host-based resolution (subdomain or custom domain)
    const host = getHeader('host') || '';
    const cleanHost = host.split(':')[0].toLowerCase();

    if (cleanHost && !cleanHost.startsWith('localhost') && !cleanHost.startsWith('127.0.0.1')) {
      const parts = cleanHost.split('.');
      if (parts.length >= 3) {
        const subdomain = parts[0];
        if (subdomain !== 'www' && subdomain !== 'api' && subdomain !== 'app') {
          return {
            tenantId: `tenant-${subdomain}-id`,
            subdomain,
            planTier: 'PROFESSIONAL',
            isolationTier: 'SHARED_RLS',
            region: 'singapore',
            channelModules: ['DMS_CORE', 'SFA', 'VAN_SALES', 'TRADE_SCHEMES'],
          };
        }
      } else if (parts.length === 2) {
        // Custom domain lookup e.g. acme-distrib.com
        return {
          tenantId: `custom-domain-${cleanHost}`,
          customDomain: cleanHost,
          planTier: 'ENTERPRISE',
          isolationTier: 'DEDICATED_CLUSTER',
          region: 'singapore',
          channelModules: ['DMS_CORE', 'SFA', 'VAN_SALES', 'TRADE_SCHEMES', 'ANALYTICS'],
        };
      }
    }

    // 4. Default Fallback Context
    return {
      tenantId: TenantResolver.DEFAULT_TENANT_ID,
      planTier: 'PROFESSIONAL',
      isolationTier: 'SHARED_RLS',
      region: 'singapore',
      channelModules: ['DMS_CORE', 'SFA', 'VAN_SALES', 'TRADE_SCHEMES'],
    };
  }
}
