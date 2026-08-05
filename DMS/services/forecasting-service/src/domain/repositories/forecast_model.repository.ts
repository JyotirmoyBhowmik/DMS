import { ForecastModelAggregate, ForecastAlgorithm, ForecastModelStatus } from '../entities/forecast_model.entity.js';

export interface ForecastModelFilter {
  tenantId: string;
  modelName?: string;
  algorithm?: ForecastAlgorithm;
  status?: ForecastModelStatus;
  page?: number;
  pageSize?: number;
  sortBy?: 'createdAt' | 'modelName';
  sortOrder?: 'asc' | 'desc';
}

export interface ForecastModelRepository {
  save(model: ForecastModelAggregate): Promise<ForecastModelAggregate>;
  findById(id: string, tenantId: string): Promise<ForecastModelAggregate | null>;
  findByName(modelName: string, tenantId: string): Promise<ForecastModelAggregate | null>;
  findAll(filter: ForecastModelFilter): Promise<{ models: ForecastModelAggregate[]; total: number; page: number; pageSize: number }>;
  delete(id: string, tenantId: string): Promise<boolean>;
}
