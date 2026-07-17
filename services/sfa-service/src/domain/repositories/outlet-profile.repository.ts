import { OutletProfile } from '../entities/outlet-profile';

/**
 * Repository port for OutletProfile aggregate persistence.
 */
export abstract class OutletProfileRepository {
  abstract save(profile: OutletProfile): Promise<OutletProfile>;
  abstract findById(id: string, tenantId: string): Promise<OutletProfile | null>;
  abstract findAll(tenantId: string): Promise<OutletProfile[]>;
  abstract delete(id: string, tenantId: string): Promise<void>;
}
