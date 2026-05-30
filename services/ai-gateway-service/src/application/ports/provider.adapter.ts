/**
 * Port interface for AI provider adapters.
 * Each provider (OpenAI, Vertex, Internal, SageMaker) implements this interface.
 */
export interface ProviderInvokeResult {
  output: Record<string, unknown>;
  tokensUsed: { input: number; output: number };
  latencyMs: number;
}

export interface IProviderAdapter {
  readonly name: string;
  invoke(prompt: string, params: Record<string, unknown>): Promise<ProviderInvokeResult>;
}
