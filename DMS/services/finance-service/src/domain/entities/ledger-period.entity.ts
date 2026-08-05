export type LedgerPeriodStatus = 'OPEN' | 'CLOSED';

export class LedgerPeriod {
  id: string;
  tenantId: string;
  startDate: Date;
  endDate: Date;
  status: LedgerPeriodStatus;
  createdAt?: Date;
  updatedAt?: Date;

  constructor(data: Partial<LedgerPeriod>) {
    this.id = data.id || '';
    this.tenantId = data.tenantId || '';
    this.startDate = data.startDate || new Date();
    this.endDate = data.endDate || new Date();
    this.status = data.status || 'OPEN';
    this.createdAt = data.createdAt;
    this.updatedAt = data.updatedAt;
  }

  isOpen(): boolean {
    return this.status === 'OPEN';
  }

  contains(date: Date): boolean {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    const start = new Date(this.startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(this.endDate);
    end.setHours(23, 59, 59, 999);
    return d >= start && d <= end;
  }
}
