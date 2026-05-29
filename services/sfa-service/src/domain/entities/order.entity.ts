import { PII, Encrypted, Tenant } from '@dms/pkg-database';

export class OrderEntity {
  id: string;

  @Tenant()
  tenantId: string;

  outletId: string;

  @Encrypted()
  totalAmount: number;

  @PII()
  notes?: string;

  items: Array<{
    skuId: string;
    quantity: number;
    price: number;
  }>;

  constructor(data: Partial<OrderEntity>) {
    this.id = data.id || '';
    this.tenantId = data.tenantId || '';
    this.outletId = data.outletId || '';
    this.totalAmount = data.totalAmount || 0;
    this.notes = data.notes;
    this.items = data.items || [];
  }
}
