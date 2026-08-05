/**
 * PromptTemplate domain entity.
 * Manages versioned prompt templates with {{variable}} placeholder rendering.
 * Pure TypeScript — no decorators.
 */
export interface PromptTemplateProps {
  id: string;
  name: string;
  version: number;
  template: string;
  variables: string[];
  modelId: string;
  systemPrompt: string;
  temperature: number;
  maxOutputTokens: number;
  createdAt: Date;
  updatedAt: Date;
}

export class PromptTemplate {
  private props: PromptTemplateProps;

  private constructor(props: PromptTemplateProps) {
    this.props = { ...props, variables: [...props.variables] };
  }

  static create(input: {
    id: string;
    name: string;
    template: string;
    variables: string[];
    modelId: string;
    systemPrompt?: string;
    temperature?: number;
    maxOutputTokens?: number;
  }): PromptTemplate {
    const now = new Date();
    return new PromptTemplate({
      ...input,
      version: 1,
      systemPrompt: input.systemPrompt ?? '',
      temperature: input.temperature ?? 0.7,
      maxOutputTokens: input.maxOutputTokens ?? 1024,
      createdAt: now,
      updatedAt: now,
    });
  }

  static reconstitute(props: PromptTemplateProps): PromptTemplate {
    return new PromptTemplate(props);
  }

  // ── Accessors ──────────────────────────────────────────────────
  get id(): string { return this.props.id; }
  get name(): string { return this.props.name; }
  get version(): number { return this.props.version; }
  get template(): string { return this.props.template; }
  get variables(): ReadonlyArray<string> { return this.props.variables; }
  get modelId(): string { return this.props.modelId; }
  get systemPrompt(): string { return this.props.systemPrompt; }
  get temperature(): number { return this.props.temperature; }
  get maxOutputTokens(): number { return this.props.maxOutputTokens; }
  get createdAt(): Date { return this.props.createdAt; }
  get updatedAt(): Date { return this.props.updatedAt; }

  // ── Mutations ──────────────────────────────────────────────────

  /**
   * Render the template by replacing {{variable}} placeholders with values.
   * Throws if a required variable is missing from the provided values.
   */
  render(values: Record<string, string>): string {
    let rendered = this.props.template;
    for (const varName of this.props.variables) {
      const placeholder = `{{${varName}}}`;
      if (rendered.includes(placeholder)) {
        if (values[varName] === undefined) {
          throw new Error(`Missing required template variable: ${varName}`);
        }
        rendered = rendered.replaceAll(placeholder, values[varName]);
      }
    }
    return rendered;
  }

  updateTemplate(template: string, variables: string[]): void {
    this.props.template = template;
    this.props.variables = [...variables];
    this.props.updatedAt = new Date();
  }

  bumpVersion(): void {
    this.props.version += 1;
    this.props.updatedAt = new Date();
  }

  updateSystemPrompt(systemPrompt: string): void {
    this.props.systemPrompt = systemPrompt;
    this.props.updatedAt = new Date();
  }

  updateTemperature(temperature: number): void {
    this.props.temperature = temperature;
    this.props.updatedAt = new Date();
  }

  toJSON(): Record<string, unknown> {
    return {
      id: this.props.id,
      name: this.props.name,
      version: this.props.version,
      template: this.props.template,
      variables: [...this.props.variables],
      modelId: this.props.modelId,
      systemPrompt: this.props.systemPrompt,
      temperature: this.props.temperature,
      maxOutputTokens: this.props.maxOutputTokens,
      createdAt: this.props.createdAt.toISOString(),
      updatedAt: this.props.updatedAt.toISOString(),
    };
  }
}
