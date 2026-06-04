import { BeatRoute } from '../entities/beat-route';

/**
 * Repository port for BeatRoute aggregate persistence.
 */
export abstract class BeatRouteRepository {
  abstract save(beatRoute: BeatRoute): Promise<BeatRoute>;
  abstract findById(id: string, tenantId: string): Promise<BeatRoute | null>;
  abstract findAll(tenantId: string): Promise<BeatRoute[]>;
  abstract findByRegion(region: string, tenantId: string): Promise<BeatRoute[]>;
  abstract findByAgent(agentId: string, tenantId: string): Promise<BeatRoute[]>;
  abstract delete(id: string, tenantId: string): Promise<void>;
}
