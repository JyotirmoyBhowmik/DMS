import { TaxFilingStatus } from '../../domain/entities/tax-filing.entity.js';

export interface CreateTaxFilingDto {
  period: string;
  taxType: string;
  taxableAmountCents?: number;
  taxAmountCents?: number;
  acknowledgementNumber?: string;
  filingDate?: string;
  idempotencyKey?: string;
}

export interface UpdateTaxFilingDto {
  status: TaxFilingStatus;
  acknowledgementNumber?: string;
  version: number;
}

export interface TaxFilingResponseDto {
  id: string;
  tenantId: string;
  period: string;
  taxType: string;
  taxableAmountCents: number;
  taxAmountCents: number;
  status: TaxFilingStatus;
  acknowledgementNumber?: string;
  filingDate?: string;
  idempotencyKey?: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}
