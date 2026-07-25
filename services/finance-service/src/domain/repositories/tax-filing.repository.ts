import { TaxFiling, TaxFilingStatus } from '../entities/tax-filing.entity.js';

export interface ListTaxFilingsOptions {
  page?: number;
  limit?: number;
  status?: TaxFilingStatus;
  period?: string;
  taxType?: string;
  sortBy?: 'createdAt' | 'period' | 'taxAmountCents';
  sortOrder?: 'ASC' | 'DESC';
}

export interface TaxFilingRepository {
  save(taxFiling: TaxFiling, tenantId: string): Promise<TaxFiling>;
  findById(id: string, tenantId: string): Promise<TaxFiling | null>;
  findByPeriodAndType(period: string, taxType: string, tenantId: string): Promise<TaxFiling | null>;
  list(tenantId: string, options?: ListTaxFilingsOptions): Promise<{ items: TaxFiling[]; total: number }>;
  update(taxFiling: TaxFiling, tenantId: string): Promise<TaxFiling>;
  delete(id: string, tenantId: string): Promise<boolean>;
}
