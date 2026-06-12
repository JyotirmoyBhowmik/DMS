import { BasePostgresRepository, BaseRow, PostgresDatabaseClient, EntityNotFoundError } from '@dms/pkg-database';
import { Product } from '../../../domain/entities/product.js';
import { ProductRepository } from '../../../domain/repositories/product.repository.js';

export class ProductPgRepository extends BasePostgresRepository<Product> implements ProductRepository {
  constructor(db: PostgresDatabaseClient) {
    super(db);
  }

  protected tableName(): string {
    return 'products_skus';
  }

  protected mapToEntity(row: BaseRow): Product {
    return new Product(
      row.id as string,
      row.tenant_id as string,
      row.sku as string,
      row.name as string,
      row.category as string,
      Number(row.price),
      Number(row.min_threshold)
    );
  }

  protected mapToRow(entity: Product): BaseRow {
    return {
      id: entity.id,
      tenant_id: entity.tenantId,
      sku: entity.sku,
      name: entity.name,
      category: entity.category,
      price: entity.price,
      min_threshold: entity.minThreshold,
      version: 1,
      created_at: new Date(),
      updated_at: new Date(),
    };
  }

  async findBySku(sku: string, tenantId: string): Promise<Product | null> {
    const sql = `SELECT * FROM "${this.tableName()}" WHERE "sku" = $1 AND "tenant_id" = $2 LIMIT 1`;
    const result = await this.db.query<BaseRow>(sql, [sku, tenantId], tenantId);
    if (result.rows.length === 0) return null;
    return this.mapToEntity(result.rows[0]!);
  }

  async findByCategory(category: string, tenantId: string): Promise<Product[]> {
    const sql = `SELECT * FROM "${this.tableName()}" WHERE "category" = $1 AND "tenant_id" = $2`;
    const result = await this.db.query<BaseRow>(sql, [category, tenantId], tenantId);
    return result.rows.map(r => this.mapToEntity(r));
  }
}
