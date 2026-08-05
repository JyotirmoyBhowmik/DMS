import { ModelRegistryEntry } from '../../domain/entities/model_registry.js';
import { ModelProvider } from '../../domain/value-objects/model_provider.js';

/**
 * Port interface for ModelRegistryEntry persistence.
 */
export interface IModelRegistryRepository {
  save(model: ModelRegistryEntry): Promise<ModelRegistryEntry>;
  findById(id: string): Promise<ModelRegistryEntry | null>;
  findByName(name: string): Promise<ModelRegistryEntry | null>;
  findAll(): Promise<ModelRegistryEntry[]>;
  findByProvider(provider: ModelProvider): Promise<ModelRegistryEntry[]>;
}
