import { Collection } from '../entities/collection.entity.js';

export interface ListCollectionsOptions {
  page?: number;
  limit?: number;
  status?: string;
  distributorId?: string;
  invoiceId?: string;
  search?: string;
  sortField?: string;
  sortOrder?: 'ASC' | 'DESC';
}

export interface ListCollectionsResult {
  data: Collection[];
  total: number;
  page: number;
  limit: number;
}

export interface CollectionRepository {
  save(collection: Collection, tenantId: string): Promise<Collection>;
  findById(id: string, tenantId: string): Promise<Collection | null>;
  findByCollectionReference(collectionReference: string, tenantId: string): Promise<Collection | null>;
  list(options: ListCollectionsOptions, tenantId: string): Promise<ListCollectionsResult>;
  update(collection: Collection, tenantId: string): Promise<Collection>;
  delete(id: string, tenantId: string): Promise<void>;
}
