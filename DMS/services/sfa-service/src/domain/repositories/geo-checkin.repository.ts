import { GeoCheckIn } from '../entities/geo-checkin';

/**
 * Repository port for GeoCheckIn aggregate persistence.
 */
export abstract class GeoCheckInRepository {
  abstract save(geoCheckIn: GeoCheckIn): Promise<GeoCheckIn>;
  abstract findById(id: string, tenantId: string): Promise<GeoCheckIn | null>;
  abstract findAll(tenantId: string): Promise<GeoCheckIn[]>;
  abstract findByAgent(agentId: string, tenantId: string): Promise<GeoCheckIn[]>;
  abstract findByOutlet(outletId: string, tenantId: string): Promise<GeoCheckIn[]>;
  abstract findByVisit(visitId: string, tenantId: string): Promise<GeoCheckIn | null>;
  abstract delete(id: string, tenantId: string): Promise<void>;
}
