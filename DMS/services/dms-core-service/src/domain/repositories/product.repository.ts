import { Product } from '../entities/product.js';
import { PaginatedResult, FindAllOptions } from '@dms/pkg-database';

export interface ProductRepository {
  save(entity: Product, tenantId: string): Promise<Product>;
  findById(id: string, tenantId: string): Promise<Product>;
  findAll(tenantId: string, options?: FindAllOptions): Promise<PaginatedResult<Product>>;
  update(entity: Product, tenantId: string): Promise<Product>;
  delete(id: string, tenantId: string): Promise<boolean>;
  findBySku(sku: string, tenantId: string): Promise<Product | null>;
  findByCategory(category: string, tenantId: string): Promise<Product[]>;
}
