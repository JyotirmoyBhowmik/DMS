import { randomUUID } from 'crypto';
import { StructuredLogger } from '@dms/pkg-logger';
import { makeEnvelope } from '@dms/pkg-events';
import { InferenceRequest } from '../../domain/entities/inference_request.js';
import { InferenceAggregate } from '../../domain/aggregates/inference.aggregate.js';
import { TokenUsage } from '../../domain/value-objects/token_usage.js';
import { ModelNotFoundError, RateLimitError } from '../../domain/errors/ai.errors.js';
import { IInferenceRepository } from '../ports/inference.repository.js';
import { IModelRegistryRepository } from '../ports/model_registry.repository.js';
import { IPromptTemplateRepository } from '../ports/prompt_template.repository.js';
import { IProviderAdapter } from '../ports/provider.adapter.js';

/**
 * RunInferenceUseCase: resolves model from registry, renders prompt template,
 * dispatches to provider adapter, tracks token usage, emits inference.completed event.
 */
export class RunInferenceUseCase {
  private logger = new StructuredLogger('RunInferenceUseCase');
  private inferenceRepo: IInferenceRepository;
  private modelRegistryRepo: IModelRegistryRepository;
  private promptTemplateRepo: IPromptTemplateRepository;
  private providerAdapters: Map<string, IProviderAdapter>;

  constructor(
    inferenceRepo: IInferenceRepository,
    modelRegistryRepo: IModelRegistryRepository,
    promptTemplateRepo: IPromptTemplateRepository,
    providerAdapters: Map<string, IProviderAdapter>,
  ) {
    this.inferenceRepo = inferenceRepo;
    this.modelRegistryRepo = modelRegistryRepo;
    this.promptTemplateRepo = promptTemplateRepo;
    this.providerAdapters = providerAdapters;
  }

  async execute(input: {
    tenantId: string;
    requestedBy: string;
    modelId: string;
    inputPayload: Record<string, unknown>;
    promptTemplateId?: string;
  }): Promise<{ request: InferenceRequest }> {
    this.logger.info('Starting inference request', { modelId: input.modelId, tenantId: input.tenantId });

    // 1. Resolve model from registry
    const model = await this.modelRegistryRepo.findById(input.modelId);
    if (!model) {
      throw new ModelNotFoundError(input.modelId);
    }

    // 2. Create inference request
    const request = InferenceRequest.create({
      id: randomUUID(),
      tenantId: input.tenantId,
      modelId: input.modelId,
      modelVersion: model.version,
      inputPayload: input.inputPayload,
      requestedBy: input.requestedBy,
    });

    // 3. Validate via aggregate
    const aggregate = new InferenceAggregate(request, model);
    aggregate.validateRequest();

    // 4. Render prompt template if provided
    let promptText: string;
    if (input.promptTemplateId) {
      const template = await this.promptTemplateRepo.findById(input.promptTemplateId);
      if (template) {
        const variables = input.inputPayload as Record<string, string>;
        promptText = template.render(variables);
        this.logger.info('Prompt template rendered', { templateId: template.id, version: template.version });
      } else {
        promptText = JSON.stringify(input.inputPayload);
      }
    } else {
      promptText = input.inputPayload.prompt as string ?? JSON.stringify(input.inputPayload);
    }

    // 5. Get provider adapter
    const adapter = this.providerAdapters.get(model.provider);
    if (!adapter) {
      throw new ModelNotFoundError(input.modelId);
    }

    // 6. Invoke provider
    request.markQueued();
    request.startProcessing();

    try {
      const result = await adapter.invoke(promptText, model.defaultParams);

      // 7. Track token usage
      const costPerToken = 0.00003; // default cost per token
      const tokenUsage = TokenUsage.create(result.tokensUsed.input, result.tokensUsed.output, costPerToken);
      const costEstimate = tokenUsage.estimatedCost;

      // 8. Complete request
      aggregate.processInference(result.output, result.latencyMs, tokenUsage, costEstimate);

      this.logger.info('Inference completed successfully', {
        requestId: request.id,
        latencyMs: result.latencyMs,
        totalTokens: tokenUsage.totalTokens,
      });
    } catch (error: any) {
      aggregate.handleFailure(error.message ?? 'Unknown error');
      this.logger.error('Inference failed', { requestId: request.id, error: error.message });
    }

    // 9. Save request
    await this.inferenceRepo.save(request);

    // 10. Emit domain event
    const event = makeEnvelope(
      'inference.completed',
      'v1',
      {
        requestId: request.id,
        modelId: request.modelId,
        status: request.status,
        latencyMs: request.latencyMs,
        tokensUsed: request.tokensUsed?.toJSON() ?? null,
        costEstimate: request.costEstimate,
      },
      {
        tenantId: input.tenantId,
        correlationId: randomUUID(),
        producer: 'ai-gateway-service',
        partitionKey: request.id,
      },
    );

    this.logger.info('Inference event emitted', { eventId: event.eventId });

    return { request };
  }
}
