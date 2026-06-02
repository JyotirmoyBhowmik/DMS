import { Product } from '../../domain/entities/product.js';
import { Inventory } from '../../domain/entities/inventory.js';
import { Distributor } from '../../domain/entities/distributor.js';
import { Outlet } from '../../domain/entities/outlet.js';

export class DmsRepository {
  private products = new Map<string, Product>();
  private inventory = new Map<string, Inventory>();
  private distributors = new Map<string, Distributor>();
  private outlets = new Map<string, Outlet>();

  constructor() {
    this.seedMockData();
  }

  // --- Seed Data ---
  private seedMockData() {
    // Seed Products
    this.saveProduct(Product.create({ id: 'p-001', tenantId: 'tenant-uuid-1111', sku: 'SKU-FMCG-001', name: 'Premium Sunflower Oil 1L', category: 'Cooking Oil', price: 12.50, minThreshold: 150 }));
    this.saveProduct(Product.create({ id: 'p-002', tenantId: 'tenant-uuid-1111', sku: 'SKU-FMCG-002', name: 'Whole Wheat Atta 5kg', category: 'Flour', price: 8.90, minThreshold: 200 }));
    this.saveProduct(Product.create({ id: 'p-003', tenantId: 'tenant-uuid-1111', sku: 'SKU-FMCG-003', name: 'Refined Sugar 2kg', category: 'Sweetener', price: 3.20, minThreshold: 100 }));

    // Seed Inventory
    this.saveInventory(Inventory.create({ id: 'i-001', tenantId: 'tenant-uuid-1111', productId: 'p-001', warehouseId: 'wh-main', stock: 120 })); // Low Stock
    this.saveInventory(Inventory.create({ id: 'i-002', tenantId: 'tenant-uuid-1111', productId: 'p-002', warehouseId: 'wh-main', stock: 450 })); // Adequate
    this.saveInventory(Inventory.create({ id: 'i-003', tenantId: 'tenant-uuid-1111', productId: 'p-003', warehouseId: 'wh-main', stock: 85 }));  // Low Stock

    // Seed Distributors
    this.saveDistributor(Distributor.create({ id: 'd-001', tenantId: 'tenant-uuid-1111', name: 'Metro Wholesale Distributors', region: 'Northern Region', creditLimit: 50000, balance: 12450 }));
    this.saveDistributor(Distributor.create({ id: 'd-002', tenantId: 'tenant-uuid-1111', name: 'City FMCG Connect', region: 'Central Region', creditLimit: 30000, balance: 8290 }));

    // Seed Outlets with physical GPS bounds
    this.saveOutlet(Outlet.create({ id: 'o-001', tenantId: 'tenant-uuid-1111', name: 'ABC Retail Outlet', latitude: 28.6139, longitude: 77.2090, radiusMeters: 50 }));
    this.saveOutlet(Outlet.create({ id: 'o-002', tenantId: 'tenant-uuid-1111', name: 'Sunshine Mart', latitude: 19.0760, longitude: 72.8777, radiusMeters: 50 }));
  }

  // --- Product Methods ---
  async saveProduct(p: Product): Promise<void> {
    this.products.set(p.id, p);
  }

  async findProductById(id: string): Promise<Product | null> {
    return this.products.get(id) ?? null;
  }

  async findProductBySku(sku: string): Promise<Product | null> {
    return Array.from(this.products.values()).find(p => p.sku === sku) ?? null;
  }

  async findAllProducts(tenantId: string): Promise<Product[]> {
    return Array.from(this.products.values()).filter(p => p.tenantId === tenantId);
  }

  // --- Inventory Methods ---
  async saveInventory(i: Inventory): Promise<void> {
    this.inventory.set(i.id, i);
  }

  async findInventoryByProduct(productId: string): Promise<Inventory | null> {
    return Array.from(this.inventory.values()).find(i => i.productId === productId) ?? null;
  }

  async findLowStockInventory(tenantId: string): Promise<Array<{ product: Product; stock: number; minThreshold: number }>> {
    const lowStock: Array<{ product: Product; stock: number; minThreshold: number }> = [];
    for (const inv of this.inventory.values()) {
      if (inv.tenantId !== tenantId) continue;
      const product = await this.findProductById(inv.productId);
      if (product && inv.isBelowSafetyThreshold(product.minThreshold)) {
        lowStock.push({
          product,
          stock: inv.stock,
          minThreshold: product.minThreshold
        });
      }
    }
    return lowStock;
  }

  // --- Distributor Methods ---
  async saveDistributor(d: Distributor): Promise<void> {
    this.distributors.set(d.id, d);
  }

  async findDistributorById(id: string): Promise<Distributor | null> {
    return this.distributors.get(id) ?? null;
  }

  async findAllDistributors(tenantId: string): Promise<Distributor[]> {
    return Array.from(this.distributors.values()).filter(d => d.tenantId === tenantId);
  }

  // --- Outlet Methods ---
  async saveOutlet(o: Outlet): Promise<void> {
    this.outlets.set(o.id, o);
  }

  async findOutletById(id: string): Promise<Outlet | null> {
    return this.outlets.get(id) ?? null;
  }

  async findAllOutlets(tenantId: string): Promise<Outlet[]> {
    return Array.from(this.outlets.values()).filter(o => o.tenantId === tenantId);
  }
}
