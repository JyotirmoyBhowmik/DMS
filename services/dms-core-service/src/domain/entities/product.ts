/**
 * Product/SKU Domain Entity.
 */
export class Product {
  public readonly id: string;
  public readonly tenantId: string;
  public readonly sku: string;
  public readonly name: string;
  public readonly category: string;
  public readonly price: number;
  public readonly minThreshold: number;

  constructor(
    id: string,
    tenantId: string,
    sku: string,
    name: string,
    category: string,
    price: number,
    minThreshold: number
  ) {
    this.id = id;
    this.tenantId = tenantId;
    this.sku = sku;
    this.name = name;
    this.category = category;
    this.price = price;
    this.minThreshold = minThreshold;
  }

  static create(props: {
    id: string;
    tenantId: string;
    sku: string;
    name: string;
    category: string;
    price: number;
    minThreshold: number;
  }): Product {
    return new Product(
      props.id,
      props.tenantId,
      props.sku,
      props.name,
      props.category,
      props.price,
      props.minThreshold
    );
  }

  toJSON() {
    return {
      id: this.id,
      tenantId: this.tenantId,
      sku: this.sku,
      name: this.name,
      category: this.category,
      price: this.price,
      minThreshold: this.minThreshold,
    };
  }
}
