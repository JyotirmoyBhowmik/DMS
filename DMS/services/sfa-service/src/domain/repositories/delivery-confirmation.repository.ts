import { DeliveryConfirmation } from '../entities/delivery-confirmation.js';

export interface IDeliveryConfirmationRepository {
  save(confirmation: DeliveryConfirmation): Promise<void>;
  findById(id: string, tenantId: string): Promise<DeliveryConfirmation | null>;
  findByOrder(orderId: string, tenantId: string): Promise<DeliveryConfirmation | null>;
  findByTenant(tenantId: string, limit?: number, offset?: number): Promise<DeliveryConfirmation[]>;
  delete(id: string, tenantId: string): Promise<void>;
}
