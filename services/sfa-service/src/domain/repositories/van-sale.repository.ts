import { VanSale } from '../entities/van-sale';

/**
 * Repository port for VanSale aggregate persistence.
 */
export abstract class VanSaleRepository {
  abstract save(vanSale: VanSale): Promise<VanSale>;
  abstract findById(id: string, tenantId: string): Promise<VanSale | null>;
  abstract findAll(tenantId: string): Promise<VanSale[]>;
  abstract findByAgent(agentId: string, tenantId: string): Promise<VanSale[]>;
  abstract findByVehicle(vehicleId: string, tenantId: string): Promise<VanSale[]>;
  abstract findByRoute(routeId: string, tenantId: string): Promise<VanSale[]>;
  abstract delete(id: string, tenantId: string): Promise<void>;
}
