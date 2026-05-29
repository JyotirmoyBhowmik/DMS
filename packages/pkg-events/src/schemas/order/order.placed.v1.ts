export interface OrderPlacedV1Payload {
  orderId: string;
  outletId: string;
  distributorId: string;
  agentId: string;
  totalAmount: number;
  items: Array<{
    skuId: string;
    quantity: number;
    price: number;
  }>;
}
