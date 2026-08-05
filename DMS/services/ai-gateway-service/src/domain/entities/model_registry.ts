import { ModelProvider } from '../value-objects/model_provider.js';

/**
 * ModelRegistryEntry domain entity.
 * Represents a registered AI model available for inference.
 * Pure TypeScript — no decorators.
 */
export type ModelStatus = 'active' | 'deprecated' | 'disabled';

export interface ModelRegistryEntryProps {
  id: string;
  name: string;
  version: string;
  provider: ModelProvider;
  endpoint: string;
  apiKeyRef: string;
  status: ModelStatus;
  rateLimit: number;
  maxTokens: number;
  defaultParams: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export class ModelRegistryEntry {
  private props: ModelRegistryEntryProps;

  private constructor(props: ModelRegistryEntryProps) {
    this.props = { ...props };
  }

  static create(input: {
    id: string;
    name: string;
    version: string;
    provider: ModelProvider;
    endpoint: string;
    apiKeyRef: string;
    rateLimit: number;
    maxTokens: number;
    defaultParams?: Record<string, unknown>;
  }): ModelRegistryEntry {
    const now = new Date();
    return new ModelRegistryEntry({
      ...input,
      status: 'active',
      defaultParams: input.defaultParams ?? {},
      createdAt: now,
      updatedAt: now,
    });
  }

  static reconstitute(props: ModelRegistryEntryProps): ModelRegistryEntry {
    return new ModelRegistryEntry(props);
  }

  // ── Accessors ──────────────────────────────────────────────────
  get id(): string { return this.props.id; }
  get name(): string { return this.props.name; }
  get version(): string { return this.props.version; }
  get provider(): ModelProvider { return this.props.provider; }
  get endpoint(): string { return this.props.endpoint; }
  get apiKeyRef(): string { return this.props.apiKeyRef; }
  get status(): ModelStatus { return this.props.status; }
  get rateLimit(): number { return this.props.rateLimit; }
  get maxTokens(): number { return this.props.maxTokens; }
  get defaultParams(): Record<string, unknown> { return this.props.defaultParams; }
  get createdAt(): Date { return this.props.createdAt; }
  get updatedAt(): Date { return this.props.updatedAt; }

  // ── Mutations ──────────────────────────────────────────────────
  deprecate(): void {
    this.props.status = 'deprecated';
    this.props.updatedAt = new Date();
  }

  disable(): void {
    this.props.status = 'disabled';
    this.props.updatedAt = new Date();
  }

  activate(): void {
    this.props.status = 'active';
    this.props.updatedAt = new Date();
  }

  updateEndpoint(endpoint: string): void {
    this.props.endpoint = endpoint;
    this.props.updatedAt = new Date();
  }

  updateRateLimit(limit: number): void {
    this.props.rateLimit = limit;
    this.props.updatedAt = new Date();
  }

  updateDefaultParams(params: Record<string, unknown>): void {
    this.props.defaultParams = { ...params };
    this.props.updatedAt = new Date();
  }

  toJSON(): Record<string, unknown> {
    return {
      id: this.props.id,
      name: this.props.name,
      version: this.props.version,
      provider: this.props.provider,
      endpoint: this.props.endpoint,
      apiKeyRef: this.props.apiKeyRef,
      status: this.props.status,
      rateLimit: this.props.rateLimit,
      maxTokens: this.props.maxTokens,
      defaultParams: this.props.defaultParams,
      createdAt: this.props.createdAt.toISOString(),
      updatedAt: this.props.updatedAt.toISOString(),
    };
  }
}
