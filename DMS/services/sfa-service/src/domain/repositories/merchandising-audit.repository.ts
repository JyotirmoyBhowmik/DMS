import { MerchandisingAudit } from '../entities/merchandising-audit';

/**
 * Repository port for MerchandisingAudit aggregate persistence.
 */
export abstract class MerchandisingAuditRepository {
  abstract save(audit: MerchandisingAudit): Promise<MerchandisingAudit>;
  abstract findById(id: string, tenantId: string): Promise<MerchandisingAudit | null>;
  abstract findAll(tenantId: string): Promise<MerchandisingAudit[]>;
  abstract findByAgent(agentId: string, tenantId: string): Promise<MerchandisingAudit[]>;
  abstract findByOutlet(outletId: string, tenantId: string): Promise<MerchandisingAudit[]>;
  abstract findByVisit(visitId: string, tenantId: string): Promise<MerchandisingAudit | null>;
  abstract delete(id: string, tenantId: string): Promise<void>;
}
