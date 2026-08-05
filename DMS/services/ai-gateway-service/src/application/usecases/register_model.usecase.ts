import { randomUUID } from 'crypto';
import { StructuredLogger } from '@dms/pkg-logger';
import { ModelRegistryEntry } from '../../domain/entities/model_registry.js';
import { ModelProvider } from '../../domain/value-objects/model_provider.js';
import { IModelRegistryRepository } from '../ports/model_registry.repository.js';

/**
 * RegisterModelUseCase: adds or updates a model in the registry.
 */
export class RegisterModelUseCase {
  private logger = new StructuredLogger('RegisterModelUseCase');
  private modelRegistryRepo: IModelRegistryRepository;

  constructor(modelRegistryRepo: IModelRegistryRepository) {
    this.modelRegistryRepo = modelRegistryRepo;
  }

  async execute(input: {
    name: string;
    version: string;
    provider: ModelProvider;
    endpoint: string;
    apiKeyRef: string;
    rateLimit: number;
    maxTokens: number;
    defaultParams?: Record<string, unknown>;
  }): Promise<ModelRegistryEntry> {
    this.logger.info('Registering model', { name: input.name, version: input.version, provider: input.provider });

    const existing = await this.modelRegistryRepo.findByName(input.name);

    if (existing) {
      existing.updateEndpoint(input.endpoint);
      existing.updateRateLimit(input.rateLimit);
      if (input.defaultParams) {
        existing.updateDefaultParams(input.defaultParams);
      }
      const updated = await this.modelRegistryRepo.save(existing);
      this.logger.info('Model updated in registry', { modelId: updated.id });
      return updated;
    }

    const model = ModelRegistryEntry.create({
      id: randomUUID(),
      ...input,
    });

    const saved = await this.modelRegistryRepo.save(model);
    this.logger.info('Model registered successfully', { modelId: saved.id });
    return saved;
  }
}
