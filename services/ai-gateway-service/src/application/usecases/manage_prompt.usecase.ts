import { randomUUID } from 'crypto';
import { StructuredLogger } from '@dms/pkg-logger';
import { PromptTemplate } from '../../domain/entities/prompt_template.js';
import { IPromptTemplateRepository } from '../ports/prompt_template.repository.js';

/**
 * ManagePromptUseCase: CRUD for prompt templates with versioning.
 */
export class ManagePromptUseCase {
  private logger = new StructuredLogger('ManagePromptUseCase');
  private promptTemplateRepo: IPromptTemplateRepository;

  constructor(promptTemplateRepo: IPromptTemplateRepository) {
    this.promptTemplateRepo = promptTemplateRepo;
  }

  async create(input: {
    name: string;
    template: string;
    variables: string[];
    modelId: string;
    systemPrompt?: string;
    temperature?: number;
    maxOutputTokens?: number;
  }): Promise<PromptTemplate> {
    this.logger.info('Creating prompt template', { name: input.name });

    const promptTemplate = PromptTemplate.create({
      id: randomUUID(),
      ...input,
    });

    const saved = await this.promptTemplateRepo.save(promptTemplate);
    this.logger.info('Prompt template created', { templateId: saved.id, version: saved.version });
    return saved;
  }

  async update(id: string, input: {
    template?: string;
    variables?: string[];
    systemPrompt?: string;
    temperature?: number;
  }): Promise<PromptTemplate> {
    this.logger.info('Updating prompt template', { id });

    const existing = await this.promptTemplateRepo.findById(id);
    if (!existing) {
      throw new Error(`Prompt template not found: ${id}`);
    }

    if (input.template !== undefined && input.variables !== undefined) {
      existing.updateTemplate(input.template, input.variables);
    }

    if (input.systemPrompt !== undefined) {
      existing.updateSystemPrompt(input.systemPrompt);
    }

    if (input.temperature !== undefined) {
      existing.updateTemperature(input.temperature);
    }

    existing.bumpVersion();

    const saved = await this.promptTemplateRepo.save(existing);
    this.logger.info('Prompt template updated', { templateId: saved.id, version: saved.version });
    return saved;
  }

  async findById(id: string): Promise<PromptTemplate | null> {
    return this.promptTemplateRepo.findById(id);
  }

  async findAll(): Promise<PromptTemplate[]> {
    return this.promptTemplateRepo.findAll();
  }
}
