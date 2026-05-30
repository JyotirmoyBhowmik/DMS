import { TokenUsage } from '../../domain/value-objects/token_usage.js';

export interface ProviderRequest {
  prompt: string;
  systemPrompt?: string;
  temperature?: number;
  maxOutputTokens?: number;
  modelId?: string;
}

export interface ProviderResponse {
  output: Record<string, unknown>;
  tokensUsed: TokenUsage;
  latencyMs: number;
}

export interface IProviderAdapter {
  readonly providerName: string;
  invoke(request: ProviderRequest): Promise<ProviderResponse>;
}

export class OpenAIProviderAdapter implements IProviderAdapter {
  readonly providerName = 'openai';

  async invoke(request: ProviderRequest): Promise<ProviderResponse> {
    const start = Date.now();
    const inputTokens = this.estimateTokens(request.prompt + (request.systemPrompt ?? ''));
    const outputTokens = Math.min(
      Math.max(Math.floor(inputTokens * 0.8), 20),
      request.maxOutputTokens ?? 2048,
    );

    // Simulate latency: ~20ms per output token
    await this.simulateLatency(outputTokens);

    const latencyMs = Date.now() - start;
    const costPerInputToken = 0.00003;
    const costPerOutputToken = 0.00006;
    const estimatedCost = inputTokens * costPerInputToken + outputTokens * costPerOutputToken;

    const tokensUsed = TokenUsage.create(inputTokens, outputTokens, estimatedCost);

    return {
      output: {
        choices: [
          {
            message: {
              role: 'assistant',
              content: this.generateMockResponse(request.prompt),
            },
            finishReason: 'stop',
          },
        ],
        model: request.modelId ?? 'gpt-4',
        usage: tokensUsed.toJSON(),
      },
      tokensUsed,
      latencyMs,
    };
  }

  private estimateTokens(text: string): number {
    // Rough approximation: 1 token ≈ 4 characters
    return Math.max(Math.ceil(text.length / 4), 1);
  }

  private generateMockResponse(prompt: string): string {
    const lower = prompt.toLowerCase();
    if (lower.includes('forecast') || lower.includes('predict')) {
      return JSON.stringify({
        prediction: 'Based on historical trends, demand is expected to increase by 12% over the next quarter.',
        confidence: 0.85,
      });
    }
    if (lower.includes('recommend') || lower.includes('suggest')) {
      return JSON.stringify({
        recommendations: [
          { item: 'SKU-A', reason: 'High affinity with current basket', score: 0.92 },
          { item: 'SKU-B', reason: 'Frequently co-purchased', score: 0.87 },
        ],
      });
    }
    return JSON.stringify({
      response: `Processed prompt with ${prompt.length} characters. Analysis complete.`,
      metadata: { processingModel: 'gpt-4', timestamp: new Date().toISOString() },
    });
  }

  private simulateLatency(tokens: number): Promise<void> {
    const ms = Math.min(tokens * 2, 200);
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
