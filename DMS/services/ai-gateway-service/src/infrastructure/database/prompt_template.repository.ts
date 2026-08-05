import { PromptTemplate, PromptTemplateProps } from '../../domain/entities/prompt_template.js';

export interface IPromptTemplateRepository {
  save(template: PromptTemplate): Promise<void>;
  findById(id: string): Promise<PromptTemplate | null>;
  findAll(): Promise<PromptTemplate[]>;
}

export class InMemoryPromptTemplateRepository implements IPromptTemplateRepository {
  private store = new Map<string, PromptTemplateProps>();

  async save(template: PromptTemplate): Promise<void> {
    this.store.set(template.id, template.toJSON() as unknown as PromptTemplateProps);
  }

  async findById(id: string): Promise<PromptTemplate | null> {
    const data = this.store.get(id);
    return data ? PromptTemplate.reconstitute(data) : null;
  }

  async findAll(): Promise<PromptTemplate[]> {
    return Array.from(this.store.values()).map((d) => PromptTemplate.reconstitute(d));
  }
}
