/**
 * ProductCategory Repository Interface (Port).
 */
import { ProductCategory } from '../entities/product-category.js';

export abstract class ProductCategoryRepository {
  abstract save(category: ProductCategory): Promise<void>;
  abstract findById(tenantId: string, id: string): Promise<ProductCategory | null>;
  abstract findByParent(tenantId: string, parentCategoryId: string | null): Promise<ProductCategory[]>;
  abstract findByLevel(tenantId: string, level: number): Promise<ProductCategory[]>;
  abstract findAll(tenantId: string): Promise<ProductCategory[]>;
  abstract findDescendants(tenantId: string, categoryId: string): Promise<ProductCategory[]>;
  abstract delete(tenantId: string, id: string): Promise<void>;
}
