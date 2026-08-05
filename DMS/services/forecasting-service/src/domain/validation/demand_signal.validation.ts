import { CreateDemandSignalDto } from '../../application/dtos/demand_signal.dto.js';
import { DemandSignalType } from '../entities/demand_signal.entity.js';

export function validateCreateDemandSignalInput(dto: CreateDemandSignalDto): void {
  if (!dto) {
    throw new Error('DemandSignal payload is required.');
  }
  if (!dto.signalName || dto.signalName.trim().length === 0) {
    throw new Error('DemandSignal signalName is required.');
  }

  const validTypes: DemandSignalType[] = ['HISTORICAL_SALES', 'PROMOTION', 'SEASONALITY', 'MARKET_TREND'];
  if (dto.signalType && !validTypes.includes(dto.signalType)) {
    throw new Error(`Invalid DemandSignal signalType: ${dto.signalType}`);
  }

  if (dto.confidenceScore !== undefined && (dto.confidenceScore < 0.0 || dto.confidenceScore > 1.0)) {
    throw new Error('DemandSignal confidenceScore must be between 0.0 and 1.0.');
  }
}
