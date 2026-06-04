import { OutletCensus } from '../entities/outlet-census';

/**
 * Repository port for OutletCensus aggregate persistence.
 */
export abstract class OutletCensusRepository {
  abstract save(census: OutletCensus): Promise<OutletCensus>;
  abstract findById(id: string, tenantId: string): Promise<OutletCensus | null>;
  abstract findAll(tenantId: string): Promise<OutletCensus[]>;
  abstract findByOutlet(outletId: string, tenantId: string): Promise<OutletCensus[]>;
  abstract findByAgent(agentId: string, tenantId: string): Promise<OutletCensus[]>;
  abstract delete(id: string, tenantId: string): Promise<void>;
}
