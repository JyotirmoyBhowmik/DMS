import { randomUUID } from 'node:crypto';

export class TestFactories {
  static createMockUser(overrides: any = {}): any {
    return {
      id: randomUUID(),
      email: 'mockagent@enterprise-dms.com',
      roles: ['agent'],
      tenantId: randomUUID(),
      ...overrides
    };
  }

  static createMockDistributor(overrides: any = {}): any {
    return {
      id: randomUUID(),
      tenantId: randomUUID(),
      name: 'Mock Distributor Corp',
      creditLimit: 500000, // ₹5,000.00
      outstandingAmount: 0,
      status: 'active',
      ...overrides
    };
  }

  static createMockOutlet(overrides: any = {}): any {
    return {
      id: randomUUID(),
      tenantId: randomUUID(),
      name: 'Mock Kirana Store',
      latitude: 12.9716,
      longitude: 77.5946,
      geofenceRadiusMeters: 50,
      ...overrides
    };
  }

  static createMockProduct(overrides: any = {}): any {
    return {
      id: randomUUID(),
      tenantId: randomUUID(),
      sku: 'PROD-SKU-1001',
      name: 'Sunflower Cooking Oil 1L',
      price: 15000, // ₹150.00 (in cents)
      safetyStock: 10,
      currentStock: 100,
      ...overrides
    };
  }

  static createMockOrder(overrides: any = {}): any {
    const distributorId = overrides.distributorId || randomUUID();
    const outletId = overrides.outletId || randomUUID();
    const agentId = overrides.agentId || randomUUID();
    const tenantId = overrides.tenantId || randomUUID();

    return {
      id: randomUUID(),
      tenantId,
      distributorId,
      outletId,
      agentId,
      orderDate: new Date().toISOString(),
      status: 'pending',
      totalAmount: 15000,
      currency: 'INR',
      items: [
        {
          skuId: randomUUID(),
          productName: 'Sunflower Cooking Oil 1L',
          quantity: 2,
          unitPrice: 7500,
          totalPrice: 15000,
        }
      ],
      ...overrides
    };
  }
}

/**
 * Helper to orchestrate docker-based test containers or fallback database setups.
 */
export class TestContainersHelper {
  static getPostgresConfig() {
    return {
      host: process.env['TEST_POSTGRES_HOST'] || 'localhost',
      port: parseInt(process.env['TEST_POSTGRES_PORT'] || '5432', 10),
      username: process.env['TEST_POSTGRES_USER'] || 'postgres',
      password: process.env['TEST_POSTGRES_PASSWORD'] || 'postgres',
      database: process.env['TEST_POSTGRES_DB'] || 'dms_test',
    };
  }

  static getMessageBrokerConfig() {
    return {
      host: process.env['TEST_BROKER_HOST'] || 'localhost',
      port: parseInt(process.env['TEST_BROKER_PORT'] || '5672', 10),
      username: process.env['TEST_BROKER_USER'] || 'guest',
      password: process.env['TEST_BROKER_PASSWORD'] || 'guest',
    };
  }
}
