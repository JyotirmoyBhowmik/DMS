import { OrderApproval } from '../entities/order-approval';

/**
 * Repository port for OrderApproval aggregate persistence.
 */
export abstract class OrderApprovalRepository {
  abstract save(approval: OrderApproval): Promise<OrderApproval>;
  abstract update(approval: OrderApproval): Promise<OrderApproval>;
  abstract findById(id: string, tenantId: string): Promise<OrderApproval | null>;
  abstract findAll(tenantId: string): Promise<OrderApproval[]>;
  abstract findByOrder(orderId: string, tenantId: string): Promise<OrderApproval[]>;
  abstract findByRequester(requestedBy: string, tenantId: string): Promise<OrderApproval[]>;
  abstract findPendingByLevel(level: number, tenantId: string): Promise<OrderApproval[]>;
  abstract delete(id: string, tenantId: string): Promise<void>;
}
