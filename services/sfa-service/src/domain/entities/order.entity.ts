import { PII, Encrypted, Tenant } from '@dms/pkg-database';

export type OrderEntityStatus = 'draft' | 'placed' | 'confirmed' | 'cancelled';

export class OrderEntity {
  id: string;

  @Tenant()
  tenantId: string;

  outletId: string;

  @Encrypted()
  totalAmount: number;

  @PII()
  notes?: string;

  status?: OrderEntityStatus;

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
    this.status = data.status || 'draft';
    this.items = data.items || [];
  }
}
