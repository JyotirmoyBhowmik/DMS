import { ForecastAlgorithm, ForecastModelStatus } from '../../domain/entities/forecast_model.entity.js';

export interface CreateForecastModelDto {
  id?: string;
  modelName: string;
  algorithm?: ForecastAlgorithm;
  hyperparameters?: Record<string, any>;
  idempotencyKey?: string;
}

export interface UpdateForecastModelDto {
  action?: 'train' | 'activate' | 'retire';
  accuracyMape?: number;
  accuracyRmse?: number;
  expectedVersion: number;
}

export interface ForecastModelResponseDto {
  id: string;
  tenantId: string;
  modelName: string;
  algorithm: ForecastAlgorithm;
  status: ForecastModelStatus;
  accuracyMape?: number;
  accuracyRmse?: number;
  hyperparameters: Record<string, any>;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface ListForecastModelsQueryDto {
  modelName?: string;
  algorithm?: ForecastAlgorithm;
  status?: ForecastModelStatus;
  page?: number;
  pageSize?: number;
}
