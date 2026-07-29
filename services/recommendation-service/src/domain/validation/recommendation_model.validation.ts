import { CreateRecommendationModelDto } from '../../application/dtos/recommendation_model.dto.js';
import { RecommendationModelType } from '../entities/recommendation_model.entity.js';

export function validateCreateRecommendationModelInput(dto: CreateRecommendationModelDto): void {
  if (!dto) {
    throw new Error('RecommendationModel payload is required.');
  }
  if (!dto.modelName || dto.modelName.trim().length === 0) {
    throw new Error('RecommendationModel modelName is required.');
  }

  const validTypes: RecommendationModelType[] = ['COLLABORATIVE_FILTERING', 'CONTENT_BASED', 'RULE_BASED', 'HYBRID'];
  if (dto.modelType && !validTypes.includes(dto.modelType)) {
    throw new Error(`Invalid RecommendationModel modelType: ${dto.modelType}`);
  }
}
