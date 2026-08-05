import { CreateForecastModelDto } from '../../application/dtos/forecast_model.dto.js';
import { ForecastAlgorithm } from '../entities/forecast_model.entity.js';

export function validateCreateForecastModelInput(dto: CreateForecastModelDto): void {
  if (!dto) {
    throw new Error('ForecastModel payload is required.');
  }
  if (!dto.modelName || dto.modelName.trim().length === 0) {
    throw new Error('ForecastModel modelName is required.');
  }

  const validAlgorithms: ForecastAlgorithm[] = ['ARIMA', 'PROPHET', 'EXPONENTIAL_SMOOTHING', 'NEURAL_NETWORK'];
  if (dto.algorithm && !validAlgorithms.includes(dto.algorithm)) {
    throw new Error(`Invalid ForecastModel algorithm: ${dto.algorithm}`);
  }
}
