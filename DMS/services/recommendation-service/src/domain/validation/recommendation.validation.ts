import { CreateRecommendationDto } from '../../application/dtos/recommendation.dto.js';
import { RecommendationTargetType, RecommendationType } from '../entities/recommendation.entity.js';

export function validateCreateRecommendationInput(dto: CreateRecommendationDto): void {
  if (!dto) {
    throw new Error('Recommendation payload is required.');
  }
  if (!dto.title || dto.title.trim().length === 0) {
    throw new Error('Recommendation title is required.');
  }
  if (!dto.targetId || dto.targetId.trim().length === 0) {
    throw new Error('Recommendation targetId is required.');
  }

  const validTargetTypes: RecommendationTargetType[] = ['OUTLET', 'PRODUCT', 'DISTRIBUTOR'];
  if (dto.targetType && !validTargetTypes.includes(dto.targetType)) {
    throw new Error(`Invalid Recommendation targetType: ${dto.targetType}`);
  }

  const validRecTypes: RecommendationType[] = ['CROSS_SELL', 'UP_SELL', 'INVENTORY_REPLENISHMENT', 'PRICE_OPTIMIZATION'];
  if (dto.recommendationType && !validRecTypes.includes(dto.recommendationType)) {
    throw new Error(`Invalid Recommendation recommendationType: ${dto.recommendationType}`);
  }

  if (dto.score !== undefined && (dto.score < 0.0 || dto.score > 1.0)) {
    throw new Error('Recommendation score must be between 0.0 and 1.0.');
  }
}
