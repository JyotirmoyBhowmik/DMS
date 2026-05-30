/**
 * Model provider type and provider-specific configuration interfaces.
 */
export type ModelProvider = 'internal' | 'openai' | 'vertex' | 'sagemaker';

export interface OpenAIConfig {
  readonly apiKey: string;
  readonly organization: string;
  readonly model: string;
}

export interface VertexConfig {
  readonly projectId: string;
  readonly location: string;
  readonly model: string;
}

export interface SageMakerConfig {
  readonly endpointName: string;
  readonly region: string;
}

export interface InternalConfig {
  readonly host: string;
  readonly port: number;
  readonly modelPath: string;
}

export type ProviderConfig = OpenAIConfig | VertexConfig | SageMakerConfig | InternalConfig;

export const PROVIDER_LABELS: Record<ModelProvider, string> = {
  internal: 'Internal Model Server',
  openai: 'OpenAI API',
  vertex: 'Google Vertex AI',
  sagemaker: 'AWS SageMaker',
};
