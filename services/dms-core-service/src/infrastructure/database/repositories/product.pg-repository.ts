import { Product, ProductStatus } from '../../../domain/entities/product.js';
import { PostgresDatabaseClient } from '@dms/pkg-database';

export class ProductPgRepository {
  private static inMemoryStore = new Map<string, Product>();

  static clearStore(): void {
    this.inMemoryStore.clear();
  }

  constructor(private db: PostgresDatabaseClient) {}

  async save(product: Product): Promise<void> {
    ProductPgRepository.inMemoryStore.set(product.id, product);
    const data = product.toJSON();
    await this.db.query(
      `INSERT INTO products
        (id, tenant_id, sku, name, category, price, min_threshold, uom, status, version)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (id) DO UPDATE SET
         name = $4, category = $5, price = $6, min_threshold = $7,
         uom = $8, status = $9, version = $10`,
      [data.id, data.tenantId, data.sku, data.name, data.category, data.price,
       data.minThreshold, data.uom, data.status, data.version],
      product.tenantId
    );
  }

  async findById(tenantId: string, id: string): Promise<Product | null> {
    const mem = ProductPgRepository.inMemoryStore.get(id);
    if (mem && mem.tenantId === tenantId) return mem;

    const result = await this.db.query<any>(
      `SELECT * FROM products WHERE tenant_id = $1 AND id = $2`,
      [tenantId, id],
      tenantId
    );
    return result.rows[0] ? this.toDomain(result.rows[0]) : null;
  }

  async findBySku(tenantId: string, sku: string): Promise<Product | null> {
    const mem = Array.from(ProductPgRepository.inMemoryStore.values()).find(p => p.tenantId === tenantId && p.sku === sku);
    if (mem) return mem;

    const result = await this.db.query<any>(
      `SELECT * FROM products WHERE tenant_id = $1 AND sku = $2`,
      [tenantId, sku],
      tenantId
    );
    return result.rows[0] ? this.toDomain(result.rows[0]) : null;
  }

  async findByCategory(tenantId: string, category: string): Promise<Product[]> {
    const memList = Array.from(ProductPgRepository.inMemoryStore.values()).filter(p => p.tenantId === tenantId && p.category === category);
    if (memList.length > 0) return memList;

    const result = await this.db.query<any>(
      `SELECT * FROM products WHERE tenant_id = $1 AND category = $2`,
      [tenantId, category],
      tenantId
    );
    return result.rows.map((r: any) => this.toDomain(r));
  }

  async findByStatus(tenantId: string, status: ProductStatus): Promise<Product[]> {
    const memList = Array.from(ProductPgRepository.inMemoryStore.values()).filter(p => p.tenantId === tenantId && p.status === status);
    if (memList.length > 0) return memList;

    const result = await this.db.query<any>(
      `SELECT * FROM products WHERE tenant_id = $1 AND status = $2`,
      [tenantId, status],
      tenantId
    );
    return result.rows.map((r: any) => this.toDomain(r));
  }

  async findAll(tenantId: string): Promise<Product[]> {
    const memList = Array.from(ProductPgRepository.inMemoryStore.values()).filter(p => p.tenantId === tenantId);
    if (memList.length > 0) return memList;

    const result = await this.db.query<any>(
      `SELECT * FROM products WHERE tenant_id = $1 ORDER BY name`,
      [tenantId],
      tenantId
    );
    return result.rows.map((r: any) => this.toDomain(r));
  }

  private toDomain(row: any): Product {
    return new Product({
      id: row.id,
      tenantId: row.tenant_id,
      sku: row.sku,
      name: row.name,
      category: row.category,
      price: Number(row.price),
      minThreshold: Number(row.min_threshold ?? 10),
      uom: row.uom ?? 'UNIT',
      status: row.status as ProductStatus,
      version: row.version,
    });
  }
}
