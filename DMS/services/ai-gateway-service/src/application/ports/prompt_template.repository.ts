import { PromptTemplate } from '../../domain/entities/prompt_template.js';

/**
 * Port interface for PromptTemplate persistence.
 */
export interface IPromptTemplateRepository {
  save(template: PromptTemplate): Promise<PromptTemplate>;
  findById(id: string): Promise<PromptTemplate | null>;
  findByName(name: string): Promise<PromptTemplate | null>;
  findAll(): Promise<PromptTemplate[]>;
}
