import { TokenUsage } from '../../domain/value-objects/token_usage.js';
import type { IProviderAdapter, ProviderRequest, ProviderResponse } from './openai.adapter.js';

export class VertexProviderAdapter implements IProviderAdapter {
  readonly providerName = 'vertex';

  async invoke(request: ProviderRequest): Promise<ProviderResponse> {
    const start = Date.now();
    const inputTokens = Math.max(Math.ceil((request.prompt + (request.systemPrompt ?? '')).length / 4), 1);
    const outputTokens = Math.min(Math.max(Math.floor(inputTokens * 0.7), 15), request.maxOutputTokens ?? 2048);

    await new Promise((r) => setTimeout(r, Math.min(outputTokens * 3, 250)));

    const latencyMs = Date.now() - start;
    const costPerInputToken = 0.000025;
    const costPerOutputToken = 0.00005;
    const estimatedCost = inputTokens * costPerInputToken + outputTokens * costPerOutputToken;
    const tokensUsed = TokenUsage.create(inputTokens, outputTokens, estimatedCost);

    return {
      output: {
        candidates: [
          {
            content: {
              role: 'model',
              parts: [{ text: `Vertex AI response for prompt (${request.prompt.length} chars). Analysis generated.` }],
            },
            finishReason: 'STOP',
            safetyRatings: [{ category: 'HARM_CATEGORY_DANGEROUS', probability: 'NEGLIGIBLE' }],
          },
        ],
        usageMetadata: tokensUsed.toJSON(),
        modelVersion: request.modelId ?? 'gemini-1.5-pro',
      },
      tokensUsed,
      latencyMs,
    };
  }
}
