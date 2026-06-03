import { describe, it } from 'node:test';
import assert from 'node:assert';
import { TestFactories, TestContainersHelper } from './index.js';

describe('pkg-testing Test Suite', () => {
  it('should generate valid mock entities using TestFactories', () => {
    const user = TestFactories.createMockUser({ email: 'override@test.com' });
    assert.strictEqual(user.email, 'override@test.com');
    assert.ok(user.id);
    assert.ok(user.tenantId);

    const distributor = TestFactories.createMockDistributor();
    assert.strictEqual(distributor.name, 'Mock Distributor Corp');
    assert.strictEqual(distributor.creditLimit, 500000);

    const outlet = TestFactories.createMockOutlet();
    assert.strictEqual(outlet.name, 'Mock Kirana Store');
    assert.strictEqual(outlet.geofenceRadiusMeters, 50);

    const product = TestFactories.createMockProduct();
    assert.strictEqual(product.sku, 'PROD-SKU-1001');
    assert.strictEqual(product.price, 15000);

    const order = TestFactories.createMockOrder();
    assert.strictEqual(order.status, 'pending');
    assert.strictEqual(order.items.length, 1);
  });

  it('should return default configs and handle Docker failures gracefully', async () => {
    const pgConfig = TestContainersHelper.getPostgresConfig();
    assert.strictEqual(pgConfig.username, 'postgres');
    assert.strictEqual(pgConfig.database, 'dms_test');

    const brokerConfig = TestContainersHelper.getMessageBrokerConfig();
    assert.strictEqual(brokerConfig.host, 'localhost');

    // Verify Docker functions execute and catch errors gracefully when Docker is missing
    await assert.doesNotReject(async () => {
      await TestContainersHelper.startPostgres();
    });

    await assert.doesNotReject(async () => {
      await TestContainersHelper.startBroker();
    });

    assert.doesNotThrow(() => {
      TestContainersHelper.stopAll();
    });
  });
});
