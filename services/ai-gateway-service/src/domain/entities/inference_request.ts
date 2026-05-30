import { TokenUsage } from '../value-objects/token_usage.js';
import { ModelProvider } from '../value-objects/model_provider.js';

/**
 * InferenceRequest domain entity.
 * Represents a single inference request through its lifecycle.
 * Pure TypeScript — no decorators.
 */
export type InferenceStatus = 'received' | 'queued' | 'processing' | 'completed' | 'failed' | 'timeout';

export interface InferenceRequestProps {
  id: string;
  tenantId: string;
  modelId: string;
  modelVersion: string;
  inputPayload: Record<string, unknown>;
  outputPayload: Record<string, unknown> | null;
  status: InferenceStatus;
  latencyMs: number | null;
  tokensUsed: TokenUsage | null;
  costEstimate: number | null;
  requestedBy: string;
  createdAt: Date;
  completedAt: Date | null;
  failureReason: string | null;
}

export class InferenceRequest {
  private props: InferenceRequestProps;

  private constructor(props: InferenceRequestProps) {
    this.props = { ...props };
  }

  static create(input: {
    id: string;
    tenantId: string;
    modelId: string;
    modelVersion: string;
    inputPayload: Record<string, unknown>;
    requestedBy: string;
  }): InferenceRequest {
    return new InferenceRequest({
      ...input,
      outputPayload: null,
      status: 'received',
      latencyMs: null,
      tokensUsed: null,
      costEstimate: null,
      createdAt: new Date(),
      completedAt: null,
      failureReason: null,
    });
  }

  static reconstitute(props: InferenceRequestProps): InferenceRequest {
    let tokensUsed = props.tokensUsed;
    if (tokensUsed && !(tokensUsed instanceof TokenUsage)) {
      const raw = tokensUsed as unknown as { inputTokens: number; outputTokens: number; estimatedCost: number };
      tokensUsed = TokenUsage.fromRaw(raw.inputTokens, raw.outputTokens, raw.estimatedCost);
    }
    return new InferenceRequest({
      ...props,
      tokensUsed,
    });
  }


  // ── Accessors ──────────────────────────────────────────────────
  get id(): string { return this.props.id; }
  get tenantId(): string { return this.props.tenantId; }
  get modelId(): string { return this.props.modelId; }
  get modelVersion(): string { return this.props.modelVersion; }
  get inputPayload(): Record<string, unknown> { return this.props.inputPayload; }
  get outputPayload(): Record<string, unknown> | null { return this.props.outputPayload; }
  get status(): InferenceStatus { return this.props.status; }
  get latencyMs(): number | null { return this.props.latencyMs; }
  get tokensUsed(): TokenUsage | null { return this.props.tokensUsed; }
  get costEstimate(): number | null { return this.props.costEstimate; }
  get requestedBy(): string { return this.props.requestedBy; }
  get createdAt(): Date { return this.props.createdAt; }
  get completedAt(): Date | null { return this.props.completedAt; }
  get failureReason(): string | null { return this.props.failureReason; }

  // ── Mutations ──────────────────────────────────────────────────
  markQueued(): void {
    this.props.status = 'queued';
  }

  startProcessing(): void {
    this.props.status = 'processing';
  }

  complete(
    output: Record<string, unknown>,
    latencyMs: number,
    tokensUsed: TokenUsage,
    costEstimate: number,
  ): void {
    this.props.status = 'completed';
    this.props.outputPayload = output;
    this.props.latencyMs = latencyMs;
    this.props.tokensUsed = tokensUsed;
    this.props.costEstimate = costEstimate;
    this.props.completedAt = new Date();
  }

  fail(reason: string): void {
    this.props.status = 'failed';
    this.props.failureReason = reason;
    this.props.completedAt = new Date();
  }

  markTimeout(): void {
    this.props.status = 'timeout';
    this.props.failureReason = 'Request timed out';
    this.props.completedAt = new Date();
  }

  toJSON(): Record<string, unknown> {
    return {
      id: this.props.id,
      tenantId: this.props.tenantId,
      modelId: this.props.modelId,
      modelVersion: this.props.modelVersion,
      inputPayload: this.props.inputPayload,
      outputPayload: this.props.outputPayload,
      status: this.props.status,
      latencyMs: this.props.latencyMs,
      tokensUsed: this.props.tokensUsed?.toJSON() ?? null,
      costEstimate: this.props.costEstimate,
      requestedBy: this.props.requestedBy,
      createdAt: this.props.createdAt.toISOString(),
      completedAt: this.props.completedAt?.toISOString() ?? null,
      failureReason: this.props.failureReason,
    };
  }
}
