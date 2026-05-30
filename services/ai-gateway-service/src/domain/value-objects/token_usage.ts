/**
 * Immutable TokenUsage value object.
 * Tracks input/output token counts and estimated cost.
 */
export class TokenUsage {
  public readonly inputTokens: number;
  public readonly outputTokens: number;
  public readonly totalTokens: number;
  public readonly estimatedCost: number;

  private constructor(inputTokens: number, outputTokens: number, estimatedCost: number) {
    this.inputTokens = inputTokens;
    this.outputTokens = outputTokens;
    this.totalTokens = inputTokens + outputTokens;
    this.estimatedCost = estimatedCost;
  }

  static create(inputTokens: number, outputTokens: number, costPerToken: number): TokenUsage {
    const totalTokens = inputTokens + outputTokens;
    const estimatedCost = Math.round(totalTokens * costPerToken * 1_000_000) / 1_000_000;
    return new TokenUsage(inputTokens, outputTokens, estimatedCost);
  }

  static fromRaw(inputTokens: number, outputTokens: number, estimatedCost: number): TokenUsage {
    return new TokenUsage(inputTokens, outputTokens, estimatedCost);
  }

  equals(other: TokenUsage): boolean {
    return (
      this.inputTokens === other.inputTokens &&
      this.outputTokens === other.outputTokens &&
      this.estimatedCost === other.estimatedCost
    );
  }

  toJSON(): Record<string, unknown> {
    return {
      inputTokens: this.inputTokens,
      outputTokens: this.outputTokens,
      totalTokens: this.totalTokens,
      estimatedCost: this.estimatedCost,
    };
  }
}
