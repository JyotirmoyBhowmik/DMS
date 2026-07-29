import { CreateFeatureFlagDto } from '../../application/dtos/feature_flag.dto.js';
import { FlagStrategy } from '../entities/feature_flag.entity.js';

export function validateCreateFeatureFlagInput(dto: CreateFeatureFlagDto): void {
  if (!dto) {
    throw new Error('FeatureFlag payload is required.');
  }
  if (!dto.flagKey || dto.flagKey.trim().length === 0) {
    throw new Error('FeatureFlag flagKey is required.');
  }

  const keyRegex = /^[A-Za-z0-9_.-]+$/;
  if (!keyRegex.test(dto.flagKey.trim())) {
    throw new Error(`Invalid FeatureFlag flagKey format: '${dto.flagKey}'. Only alphanumeric, dot, dash, underscore allowed.`);
  }

  const validStrategies: FlagStrategy[] = ['BOOLEAN', 'PERCENTAGE', 'GRADUAL'];
  if (dto.strategy && !validStrategies.includes(dto.strategy)) {
    throw new Error(`Invalid FeatureFlag strategy: ${dto.strategy}`);
  }

  if (dto.rolloutPercentage !== undefined && (dto.rolloutPercentage < 0 || dto.rolloutPercentage > 100)) {
    throw new Error('FeatureFlag rolloutPercentage must be between 0 and 100.');
  }
}
