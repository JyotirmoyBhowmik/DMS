import { TokenUsage } from '../../domain/value-objects/token_usage.js';
import type { IProviderAdapter, ProviderRequest, ProviderResponse } from './openai.adapter.js';

export class InternalProviderAdapter implements IProviderAdapter {
  readonly providerName = 'internal';

  async invoke(request: ProviderRequest): Promise<ProviderResponse> {
    const start = Date.now();
    const inputTokens = Math.max(Math.ceil(request.prompt.length / 4), 1);
    const outputTokens = Math.min(Math.max(Math.floor(inputTokens * 0.5), 10), request.maxOutputTokens ?? 1024);

    await new Promise((r) => setTimeout(r, Math.min(outputTokens, 100)));

    const latencyMs = Date.now() - start;
    const tokensUsed = TokenUsage.create(inputTokens, outputTokens, 0);

    return {
      output: {
        result: `Internal model processed ${inputTokens} input tokens and generated ${outputTokens} output tokens.`,
        model: request.modelId ?? 'internal-v1',
        confidence: 0.88,
      },
      tokensUsed,
      latencyMs,
    };
  }
}
