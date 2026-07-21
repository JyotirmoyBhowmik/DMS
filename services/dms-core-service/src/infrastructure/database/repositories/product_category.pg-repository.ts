import { ProductCategory, ProductCategoryStatus } from '../../../domain/entities/product_category.js';
import { PostgresDatabaseClient } from '@dms/pkg-database';

export class ProductCategoryPgRepository {
  private static inMemoryStore = new Map<string, ProductCategory>();

  static clearStore(): void {
    this.inMemoryStore.clear();
  }

  constructor(private db: PostgresDatabaseClient) {}

  async save(category: ProductCategory): Promise<void> {
    ProductCategoryPgRepository.inMemoryStore.set(category.id, category);
    const data = category.toJSON();
    await this.db.query(
      `INSERT INTO product_categories
        (id, tenant_id, code, name, parent_category_id, description, status, version)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (id) DO UPDATE SET
         name = $4, parent_category_id = $5, description = $6,
         status = $7, version = $8`,
      [data.id, data.tenantId, data.code, data.name, data.parentCategoryId,
       data.description, data.status, data.version],
      category.tenantId
    );
  }

  async findById(tenantId: string, id: string): Promise<ProductCategory | null> {
    const mem = ProductCategoryPgRepository.inMemoryStore.get(id);
    if (mem && mem.tenantId === tenantId) return mem;

    const result = await this.db.query<any>(
      `SELECT * FROM product_categories WHERE tenant_id = $1 AND id = $2`,
      [tenantId, id],
      tenantId
    );
    return result.rows[0] ? this.toDomain(result.rows[0]) : null;
  }

  async findByCode(tenantId: string, code: string): Promise<ProductCategory | null> {
    const mem = Array.from(ProductCategoryPgRepository.inMemoryStore.values()).find(c => c.tenantId === tenantId && c.code === code);
    if (mem) return mem;

    const result = await this.db.query<any>(
      `SELECT * FROM product_categories WHERE tenant_id = $1 AND code = $2`,
      [tenantId, code],
      tenantId
    );
    return result.rows[0] ? this.toDomain(result.rows[0]) : null;
  }

  async findByStatus(tenantId: string, status: ProductCategoryStatus): Promise<ProductCategory[]> {
    const memList = Array.from(ProductCategoryPgRepository.inMemoryStore.values()).filter(c => c.tenantId === tenantId && c.status === status);
    if (memList.length > 0) return memList;

    const result = await this.db.query<any>(
      `SELECT * FROM product_categories WHERE tenant_id = $1 AND status = $2`,
      [tenantId, status],
      tenantId
    );
    return result.rows.map((r: any) => this.toDomain(r));
  }

  async findAll(tenantId: string): Promise<ProductCategory[]> {
    const memList = Array.from(ProductCategoryPgRepository.inMemoryStore.values()).filter(c => c.tenantId === tenantId);
    if (memList.length > 0) return memList;

    const result = await this.db.query<any>(
      `SELECT * FROM product_categories WHERE tenant_id = $1 ORDER BY name`,
      [tenantId],
      tenantId
    );
    return result.rows.map((r: any) => this.toDomain(r));
  }

  private toDomain(row: any): ProductCategory {
    return new ProductCategory({
      id: row.id,
      tenantId: row.tenant_id,
      code: row.code,
      name: row.name,
      parentCategoryId: row.parent_category_id,
      description: row.description,
      status: row.status as ProductCategoryStatus,
      version: row.version,
    });
  }
}
