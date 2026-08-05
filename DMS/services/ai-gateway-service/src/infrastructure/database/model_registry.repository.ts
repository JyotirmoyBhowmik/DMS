import { ModelRegistryEntry, ModelRegistryEntryProps } from '../../domain/entities/model_registry.js';

export interface IModelRegistryRepository {
  save(entry: ModelRegistryEntry): Promise<void>;
  findById(id: string): Promise<ModelRegistryEntry | null>;
  findAll(): Promise<ModelRegistryEntry[]>;
  findByName(name: string): Promise<ModelRegistryEntry | null>;
}

export class InMemoryModelRegistryRepository implements IModelRegistryRepository {
  private store = new Map<string, ModelRegistryEntryProps>();

  constructor() {
    this.seed();
  }

  private seed(): void {
    const now = new Date();
    const seedModels: ModelRegistryEntryProps[] = [
      {
        id: 'model-gpt4',
        name: 'gpt-4',
        version: '1.0',
        provider: 'openai',
        endpoint: 'https://api.openai.com/v1/chat/completions',
        apiKeyRef: 'vault://openai-api-key',
        status: 'active',
        rateLimit: 60,
        maxTokens: 8192,
        defaultParams: { temperature: 0.7, top_p: 1 },
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'model-gemini',
        name: 'gemini-1.5-pro',
        version: '1.0',
        provider: 'vertex',
        endpoint: 'https://us-central1-aiplatform.googleapis.com/v1/projects/dms/locations/us-central1/publishers/google/models/gemini-1.5-pro',
        apiKeyRef: 'vault://vertex-service-account',
        status: 'active',
        rateLimit: 100,
        maxTokens: 32768,
        defaultParams: { temperature: 0.5 },
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'model-internal-v1',
        name: 'dms-demand-predictor',
        version: '2.1',
        provider: 'internal',
        endpoint: 'http://ml-serving:8080/v1/predict',
        apiKeyRef: '',
        status: 'active',
        rateLimit: 500,
        maxTokens: 4096,
        defaultParams: {},
        createdAt: now,
        updatedAt: now,
      },
    ];

    for (const m of seedModels) {
      this.store.set(m.id, m);
    }
  }

  async save(entry: ModelRegistryEntry): Promise<void> {
    this.store.set(entry.id, entry.toJSON() as unknown as ModelRegistryEntryProps);
  }

  async findById(id: string): Promise<ModelRegistryEntry | null> {
    const data = this.store.get(id);
    return data ? ModelRegistryEntry.reconstitute(data) : null;
  }

  async findAll(): Promise<ModelRegistryEntry[]> {
    return Array.from(this.store.values()).map((d) => ModelRegistryEntry.reconstitute(d));
  }

  async findByName(name: string): Promise<ModelRegistryEntry | null> {
    const data = Array.from(this.store.values()).find((d) => d.name === name);
    return data ? ModelRegistryEntry.reconstitute(data) : null;
  }
}
