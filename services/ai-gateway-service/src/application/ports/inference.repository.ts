import { InferenceRequest } from '../../domain/entities/inference_request.js';

/**
 * Port interface for InferenceRequest persistence.
 */
export interface IInferenceRepository {
  save(request: InferenceRequest): Promise<InferenceRequest>;
  findById(id: string): Promise<InferenceRequest | null>;
  findByTenantId(tenantId: string, options?: { limit?: number; offset?: number }): Promise<InferenceRequest[]>;
  findAll(options?: { limit?: number; offset?: number }): Promise<InferenceRequest[]>;
}
