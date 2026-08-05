import { InferenceRequest } from '../entities/inference_request.js';
import { ModelRegistryEntry } from '../entities/model_registry.js';
import { TokenUsage } from '../value-objects/token_usage.js';
import { ModelNotFoundError, TokenLimitExceededError } from '../errors/ai.errors.js';

/**
 * InferenceAggregate managing request lifecycle, tracking token usage,
 * and enforcing model constraints.
 */
export class InferenceAggregate {
  private request: InferenceRequest;
  private model: ModelRegistryEntry | null;

  constructor(request: InferenceRequest, model?: ModelRegistryEntry) {
    this.request = request;
    this.model = model ?? null;
  }

  getRequest(): InferenceRequest {
    return this.request;
  }

  getModel(): ModelRegistryEntry | null {
    return this.model;
  }

  /**
   * Validates that the model is active and token limits are respected.
   */
  validateRequest(estimatedInputTokens?: number): void {
    if (!this.model) {
      throw new ModelNotFoundError(this.request.modelId);
    }

    if (this.model.status !== 'active') {
      throw new ModelNotFoundError(this.request.modelId);
    }

    if (estimatedInputTokens !== undefined && estimatedInputTokens > this.model.maxTokens) {
      throw new TokenLimitExceededError(estimatedInputTokens, this.model.maxTokens);
    }
  }

  /**
   * Transitions the request to completed status with full tracking.
   */
  processInference(
    output: Record<string, unknown>,
    latencyMs: number,
    tokenUsage: TokenUsage,
    costEstimate: number,
  ): void {
    this.request.startProcessing();
    this.request.complete(output, latencyMs, tokenUsage, costEstimate);
  }

  /**
   * Handles inference failure.
   */
  handleFailure(reason: string): void {
    this.request.fail(reason);
  }

  /**
   * Handles inference timeout.
   */
  handleTimeout(): void {
    this.request.markTimeout();
  }
}
