import { InferenceRequest, InferenceRequestProps } from '../../domain/entities/inference_request.js';

export interface IInferenceRepository {
  save(request: InferenceRequest): Promise<void>;
  findById(id: string): Promise<InferenceRequest | null>;
  findByTenant(tenantId: string, limit?: number, offset?: number): Promise<InferenceRequest[]>;
}

export class InMemoryInferenceRepository implements IInferenceRepository {
  private store = new Map<string, InferenceRequestProps>();

  async save(request: InferenceRequest): Promise<void> {
    const json = request.toJSON() as unknown as InferenceRequestProps;
    this.store.set(request.id, json);
  }

  async findById(id: string): Promise<InferenceRequest | null> {
    const data = this.store.get(id);
    if (!data) return null;
    return InferenceRequest.reconstitute({
      ...data,
      createdAt: new Date(data.createdAt as unknown as string),
      completedAt: data.completedAt ? new Date(data.completedAt as unknown as string) : null,
    });
  }

  async findByTenant(tenantId: string, limit = 20, offset = 0): Promise<InferenceRequest[]> {
    const items = Array.from(this.store.values())
      .filter((r) => r.tenantId === tenantId)
      .slice(offset, offset + limit)
      .map((data) =>
        InferenceRequest.reconstitute({
          ...data,
          createdAt: new Date(data.createdAt as unknown as string),
          completedAt: data.completedAt ? new Date(data.completedAt as unknown as string) : null,
        }),
      );
    return items;
  }
}
