/**
 * Postgres Repository for ProductCategory.
 */
import { ProductCategory } from '../../../domain/entities/product-category.js';
import { ProductCategoryRepository } from '../../../domain/repositories/product-category.repository.js';

export class ProductCategoryPgRepository extends ProductCategoryRepository {
  constructor(private pool: any) {
    super();
  }

  async save(cat: ProductCategory): Promise<void> {
    const data = cat.toJSON();
    await this.pool.query(
      `INSERT INTO product_categories
        (id, tenant_id, name, parent_category_id, level, sort_order, is_active, icon_url, description, version)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (id) DO UPDATE SET
         name = $3, parent_category_id = $4, level = $5, sort_order = $6,
         is_active = $7, icon_url = $8, description = $9, version = $10`,
      [data.id, data.tenantId, data.name, data.parentCategoryId ?? null,
       data.level, data.sortOrder, data.isActive, data.iconUrl ?? null,
       data.description ?? null, data.version]
    );
  }

  async findById(tenantId: string, id: string): Promise<ProductCategory | null> {
    const result = await this.pool.query(
      `SELECT * FROM product_categories WHERE tenant_id = $1 AND id = $2`,
      [tenantId, id]
    );
    return result.rows[0] ? this.toDomain(result.rows[0]) : null;
  }

  async findByParent(tenantId: string, parentCategoryId: string | null): Promise<ProductCategory[]> {
    const result = parentCategoryId
      ? await this.pool.query(
          `SELECT * FROM product_categories WHERE tenant_id = $1 AND parent_category_id = $2 ORDER BY sort_order, name`,
          [tenantId, parentCategoryId]
        )
      : await this.pool.query(
          `SELECT * FROM product_categories WHERE tenant_id = $1 AND parent_category_id IS NULL ORDER BY sort_order, name`,
          [tenantId]
        );
    return result.rows.map((r: any) => this.toDomain(r));
  }

  async findByLevel(tenantId: string, level: number): Promise<ProductCategory[]> {
    const result = await this.pool.query(
      `SELECT * FROM product_categories WHERE tenant_id = $1 AND level = $2 ORDER BY sort_order, name`,
      [tenantId, level]
    );
    return result.rows.map((r: any) => this.toDomain(r));
  }

  async findAll(tenantId: string): Promise<ProductCategory[]> {
    const result = await this.pool.query(
      `SELECT * FROM product_categories WHERE tenant_id = $1 ORDER BY level, sort_order, name`,
      [tenantId]
    );
    return result.rows.map((r: any) => this.toDomain(r));
  }

  async findDescendants(tenantId: string, categoryId: string): Promise<ProductCategory[]> {
    const result = await this.pool.query(
      `WITH RECURSIVE descendants AS (
        SELECT * FROM product_categories WHERE tenant_id = $1 AND parent_category_id = $2
        UNION ALL
        SELECT pc.* FROM product_categories pc
        INNER JOIN descendants d ON pc.parent_category_id = d.id AND pc.tenant_id = $1
      )
      SELECT * FROM descendants ORDER BY level, sort_order, name`,
      [tenantId, categoryId]
    );
    return result.rows.map((r: any) => this.toDomain(r));
  }

  async delete(tenantId: string, id: string): Promise<void> {
    await this.pool.query(
      `DELETE FROM product_categories WHERE tenant_id = $1 AND id = $2`,
      [tenantId, id]
    );
  }

  private toDomain(row: any): ProductCategory {
    return new ProductCategory({
      id: row.id,
      tenantId: row.tenant_id,
      name: row.name,
      parentCategoryId: row.parent_category_id,
      level: row.level,
      sortOrder: row.sort_order,
      isActive: row.is_active,
      iconUrl: row.icon_url,
      description: row.description,
      version: row.version,
    });
  }
}
