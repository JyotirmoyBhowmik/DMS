import { DeliveryConfirmation } from '../entities/delivery-confirmation';

export interface IDeliveryConfirmationRepository {
  save(confirmation: DeliveryConfirmation): Promise<void>;
  findById(id: string): Promise<DeliveryConfirmation | null>;
  findByOrder(orderId: string, tenantId: string): Promise<DeliveryConfirmation | null>;
  findByTenant(tenantId: string, limit?: number, offset?: number): Promise<DeliveryConfirmation[]>;
}
