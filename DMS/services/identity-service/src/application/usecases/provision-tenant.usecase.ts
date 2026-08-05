import { createHash } from 'node:crypto';
import { TenantRepository } from '../../domain/repositories/tenant.repository.js';
import { TenantAggregate, TenantDomainError, PlanTier, IsolationTier } from '../../domain/entities/tenant.entity.js';
import { UserRepository } from '../../domain/repositories/user.repository.js';
import { UserAggregate } from '../../domain/entities/user.entity.js';
import { CreateTenantDto } from '../dtos/tenant.dto.js';

export class ProvisionTenantUseCase {
  constructor(
    private readonly tenantRepository: TenantRepository,
    private readonly userRepository?: UserRepository
  ) {}

  async execute(dto: CreateTenantDto, principalTenantId?: string) {
    if (!dto.name || dto.name.trim().length === 0) {
      throw new TenantDomainError('Tenant name is required');
    }
    if (!dto.code || dto.code.trim().length === 0) {
      throw new TenantDomainError('Tenant code is required');
    }

    const tenantCode = dto.code.trim().toUpperCase();

    // Check duplicate code
    if (this.tenantRepository.findByCode) {
      const existing = await this.tenantRepository.findByCode(tenantCode);
      if (existing) {
        throw new TenantDomainError(`Tenant code '${tenantCode}' already exists`);
      }
    }

    const planTier: PlanTier = dto.planTier || 'PROFESSIONAL';
    const isolationTier: IsolationTier = dto.isolationTier || (planTier === 'ENTERPRISE' ? 'DEDICATED_CLUSTER' : 'SHARED_RLS');
    const subdomain = dto.subdomain ? dto.subdomain.toLowerCase() : tenantCode.toLowerCase();
    const region = dto.region || 'singapore';
    const channelModules = dto.channelModules || ['DMS_CORE', 'SFA', 'VAN_SALES', 'TRADE_SCHEMES'];
    const erpConfig = dto.erpConfig || { type: 'NONE', status: 'DISCONNECTED' };
    const branding = dto.branding || { primaryColor: '#0F172A', customTitle: dto.name };

    const tenant = new TenantAggregate({
      name: dto.name,
      code: tenantCode,
      subdomain,
      customDomain: dto.customDomain,
      planTier,
      isolationTier,
      region,
      erpConfig,
      channelModules,
      branding,
      status: 'ACTIVE',
    });

    const savedTenant = await this.tenantRepository.save(tenant, principalTenantId || tenant.id);

    // Create Initial Tenant Admin User if admin email is provided
    let adminUser: UserAggregate | null = null;
    if (dto.adminEmail && dto.adminPassword && this.userRepository) {
      const passwordHash = createHash('sha256').update(dto.adminPassword).digest('hex');
      adminUser = new UserAggregate({
        tenantId: savedTenant.id,
        email: dto.adminEmail,
        passwordHash,
        firstName: 'Tenant',
        lastName: 'Admin',
        roles: ['admin', 'tenant_admin'],
        status: 'ACTIVE',
      });
      await this.userRepository.save(adminUser, savedTenant.id);
    }

    return {
      tenant: savedTenant.toJSON(),
      adminUser: adminUser ? adminUser.toJSON(true) : null,
      status: 'PROVISIONED',
      message: `Tenant '${savedTenant.name}' (${savedTenant.code}) provisioned successfully.`,
    };
  }
}
