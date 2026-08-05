import { randomUUID } from 'node:crypto';
import { execSync } from 'node:child_process';

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
  private static activeContainers: string[] = [];

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

  /**
   * Spin up a real PostgreSQL container.
   * If Docker is not available, gracefully falls back to localhost configuration.
   */
  static async startPostgres(): Promise<void> {
    const name = 'dms-test-postgres';
    try {
      // Check if docker is installed and running
      execSync('docker --version', { stdio: 'ignore' });
      
      // Stop and remove existing container if it exists
      try {
        execSync(`docker rm -f ${name}`, { stdio: 'ignore' });
      } catch {
        // Ignore if container did not exist
      }

      // Run new Postgres container
      execSync(
        `docker run -d --name ${name} -p 5432:5432 -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=dms_test postgres:15`,
        { stdio: 'ignore' }
      );
      this.activeContainers.push(name);
      console.log('[TestContainersHelper] Started Postgres container successfully');

      // Wait a brief moment for Postgres to accept connections
      await new Promise(resolve => setTimeout(resolve, 3000));
    } catch {
      console.warn('[TestContainersHelper] Docker not available. Falling back to host database config.');
    }
  }

  /**
   * Spin up a real RabbitMQ/message broker container.
   * If Docker is not available, gracefully falls back to localhost configuration.
   */
  static async startBroker(): Promise<void> {
    const name = 'dms-test-broker';
    try {
      execSync('docker --version', { stdio: 'ignore' });
      
      try {
        execSync(`docker rm -f ${name}`, { stdio: 'ignore' });
      } catch {
        // Ignore
      }

      // Run new RabbitMQ container
      execSync(
        `docker run -d --name ${name} -p 5672:5672 -p 15672:15672 rabbitmq:3-management`,
        { stdio: 'ignore' }
      );
      this.activeContainers.push(name);
      console.log('[TestContainersHelper] Started Message Broker container successfully');
      
      await new Promise(resolve => setTimeout(resolve, 3000));
    } catch {
      console.warn('[TestContainersHelper] Docker not available. Falling back to host broker config.');
    }
  }

  /**
   * Terminate all active Docker containers started during testing.
   */
  static stopAll(): void {
    try {
      for (const name of this.activeContainers) {
        execSync(`docker rm -f ${name}`, { stdio: 'ignore' });
        console.log(`[TestContainersHelper] Stopped container ${name}`);
      }
      this.activeContainers = [];
    } catch {
      // Ignore cleanup failures
    }
  }
}
