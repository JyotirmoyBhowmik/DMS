import { randomUUID } from 'node:crypto';
import { InferenceRequest } from '../../../domain/entities/inference_request.js';
import { InMemoryInferenceRepository } from '../../../infrastructure/database/inference.repository.js';
import { InMemoryModelRegistryRepository } from '../../../infrastructure/database/model_registry.repository.js';
import { InMemoryPromptTemplateRepository } from '../../../infrastructure/database/prompt_template.repository.js';
import { OpenAIProviderAdapter, VertexProviderAdapter, InternalProviderAdapter } from '../../../infrastructure/providers/index.js';
import { SlidingWindowRateLimiter } from '../../../infrastructure/rate_limiter/sliding_window.js';
import type { IProviderAdapter } from '../../../infrastructure/providers/openai.adapter.js';
import { RateLimitError, ModelNotFoundError } from '../../../domain/errors/ai.errors.js';


interface RunInferenceInput {
  tenantId: string;
  modelId: string;
  prompt: string;
  systemPrompt?: string;
  temperature?: number;
  maxOutputTokens?: number;
  requestedBy: string;
}

export class InferenceController {
  private readonly inferenceRepo: InMemoryInferenceRepository;
  private readonly modelRegistry: InMemoryModelRegistryRepository;
  private readonly promptRepo: InMemoryPromptTemplateRepository;
  private readonly rateLimiter: SlidingWindowRateLimiter;
  private readonly providers: Map<string, IProviderAdapter>;

  constructor() {
    this.inferenceRepo = new InMemoryInferenceRepository();
    this.modelRegistry = new InMemoryModelRegistryRepository();
    this.promptRepo = new InMemoryPromptTemplateRepository();
    this.rateLimiter = new SlidingWindowRateLimiter(60_000);

    this.providers = new Map<string, IProviderAdapter>();
    this.providers.set('openai', new OpenAIProviderAdapter());
    this.providers.set('vertex', new VertexProviderAdapter());
    this.providers.set('internal', new InternalProviderAdapter());
  }

  async handleRunInference(body: RunInferenceInput): Promise<{ status: number; body: Record<string, unknown> }> {
    const model = await this.modelRegistry.findById(body.modelId) ?? await this.modelRegistry.findByName(body.modelId);
    if (!model) {
      return { status: 404, body: { error: `Model '${body.modelId}' not found`, code: 'MODEL_NOT_FOUND' } };
    }

    if (model.status !== 'active') {
      return { status: 400, body: { error: `Model '${model.name}' is ${model.status}`, code: 'MODEL_UNAVAILABLE' } };
    }

    if (!this.rateLimiter.tryAcquire(body.tenantId, model.id, model.rateLimit)) {
      const retryAfter = this.rateLimiter.retryAfterMs(body.tenantId, model.id);
      return { status: 429, body: { error: 'Rate limit exceeded', code: 'RATE_LIMIT', retryAfterMs: retryAfter } };
    }

    const provider = this.providers.get(model.provider);
    if (!provider) {
      return { status: 500, body: { error: `Provider '${model.provider}' not configured`, code: 'PROVIDER_UNAVAILABLE' } };
    }

    const request = InferenceRequest.create({
      id: randomUUID(),
      tenantId: body.tenantId,
      modelId: model.id,
      modelVersion: model.version,
      inputPayload: { prompt: body.prompt, systemPrompt: body.systemPrompt },
      requestedBy: body.requestedBy,
    });

    request.markQueued();
    request.startProcessing();

    try {
      const result = await provider.invoke({
        prompt: body.prompt,
        systemPrompt: body.systemPrompt,
        temperature: body.temperature ?? (model.defaultParams as Record<string, number>).temperature ?? 0.7,
        maxOutputTokens: body.maxOutputTokens ?? model.maxTokens,
        modelId: model.name,
      });

      request.complete(result.output, result.latencyMs, result.tokensUsed, result.tokensUsed.estimatedCost);
      await this.inferenceRepo.save(request);

      return { status: 200, body: request.toJSON() };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      request.fail(message);
      await this.inferenceRepo.save(request);
      return { status: 500, body: { error: message, code: 'INFERENCE_FAILED', requestId: request.id } };
    }
  }

  async handleGetInference(id: string): Promise<{ status: number; body: Record<string, unknown> }> {
    const request = await this.inferenceRepo.findById(id);
    if (!request) {
      return { status: 404, body: { error: 'Inference request not found', code: 'NOT_FOUND' } };
    }
    return { status: 200, body: request.toJSON() };
  }

  async handleListInferences(tenantId: string, limit = 20, offset = 0): Promise<{ status: number; body: Record<string, unknown> }> {
    const items = await this.inferenceRepo.findByTenant(tenantId, limit, offset);
    return { status: 200, body: { items: items.map((i) => i.toJSON()), count: items.length } };
  }

  async handleListModels(): Promise<{ status: number; body: Record<string, unknown> }> {
    const models = await this.modelRegistry.findAll();
    return { status: 200, body: { items: models.map((m) => m.toJSON()), count: models.length } };
  }

  async handleGetModel(id: string): Promise<{ status: number; body: Record<string, unknown> }> {
    const model = await this.modelRegistry.findById(id);
    if (!model) return { status: 404, body: { error: 'Model not found' } };
    return { status: 200, body: model.toJSON() };
  }
}
