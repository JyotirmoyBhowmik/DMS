import { AgeingReportStatus } from '../../domain/entities/ageing-report.entity.js';

export interface CreateAgeingReportDto {
  distributorId: string;
  asOfDate: string; // ISO Date YYYY-MM-DD
  currentBucketCents?: number;
  bucket1To30Cents?: number;
  bucket31To60Cents?: number;
  bucket61To90Cents?: number;
  bucket90PlusCents?: number;
  idempotencyKey?: string;
}

export interface UpdateAgeingReportDto {
  status: AgeingReportStatus;
  version: number;
}

export interface AgeingReportResponseDto {
  id: string;
  tenantId: string;
  distributorId: string;
  asOfDate: string;
  currentBucketCents: number;
  bucket1To30Cents: number;
  bucket31To60Cents: number;
  bucket61To90Cents: number;
  bucket90PlusCents: number;
  totalOutstandingCents: number;
  status: AgeingReportStatus;
  idempotencyKey?: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}
