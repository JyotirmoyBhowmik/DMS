import test from 'node:test';
import assert from 'node:assert';
import { Pool } from 'pg';
import { PostgresDatabaseClient, PgDriver } from './client.js';

test('PostgresDatabaseClient: Integration Tests', async (t) => {
  // Use env var or default to the docker-compose postgres
  const host = process.env.DB_HOST || 'localhost';
  const port = parseInt(process.env.DB_PORT || '5432', 10);
  const user = process.env.DB_USER || 'user';
  const password = process.env.DB_PASSWORD || 'password';
  const database = process.env.DB_NAME || 'dms';

  const pool = new Pool({
    host,
    port,
    user,
    password,
    database,
    max: 2,
    idleTimeoutMillis: 1000,
  });

  const driver = new PgDriver(pool, 2);
  const config = {
    host,
    port,
    maxConnections: 2,
    queryTimeoutMs: 2000,
    maxRetries: 1,
    retryBaseDelayMs: 50,
    circuitBreakerThreshold: 2,
    circuitBreakerResetMs: 1000,
  };

  const client = new PostgresDatabaseClient(config, driver);

  await t.test('Should execute a simple query successfully', async () => {
    const result = await client.query<{ num: number }>('SELECT 1 as num');
    assert.strictEqual(result.rows[0].num, 1);
  });

  await t.test('Should report correct pool metrics', async () => {
    const metrics = client.getPoolMetrics();
    assert.ok(metrics.totalAcquired > 0, 'Should have acquired at least 1 connection');
    assert.ok(metrics.totalReleased > 0, 'Should have released at least 1 connection');
    assert.strictEqual(metrics.activeConnections, 0, 'All connections should be released');
  });

  await t.test('Health check should pass for healthy DB', async () => {
    const health = await client.checkHealth();
    assert.strictEqual(health.status, 'HEALTHY');
  });

  await t.test('Circuit Breaker trips after consecutive failures', async () => {
    const badPool = new Pool({
      host,
      port: 9999, // intentionally wrong port to force connection error
      user,
      password,
      database,
      connectionTimeoutMillis: 50, // fast fail
      max: 2,
    });
    
    const badDriver = new PgDriver(badPool, 2);
    const badClient = new PostgresDatabaseClient({
      ...config,
      port: 9999,
      maxRetries: 0, // don't retry, fail immediately to increment circuit breaker count
      circuitBreakerThreshold: 2,
      circuitBreakerResetMs: 5000,
    }, badDriver);

    // 1st failure
    await assert.rejects(async () => {
      await badClient.query('SELECT 1');
    });

    // 2nd failure - threshold reached, trips breaker
    await assert.rejects(async () => {
      await badClient.query('SELECT 1');
    });

    // 3rd failure - should fail fast with Circuit breaker error
    await assert.rejects(async () => {
      await badClient.query('SELECT 1');
    }, /Circuit breaker is OPEN/);
    
    // Health check on bad db
    const badHealth = await badClient.checkHealth();
    assert.strictEqual(badHealth.status, 'UNHEALTHY');
    assert.strictEqual(badHealth.circuitBreaker, 'OPEN');

    await badClient.shutdown();
  });
  await t.test('RLS Policy: Live Cross-Tenant Isolation', async () => {
    // 1. Setup table
    await client.query(`DROP TABLE IF EXISTS test_rls_integration CASCADE;`);
    await client.query(`
      CREATE TABLE test_rls_integration (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL,
        data VARCHAR(100) NOT NULL
      );
    `);
    await client.query(`ALTER TABLE test_rls_integration ENABLE ROW LEVEL SECURITY;`);
    await client.query(`ALTER TABLE test_rls_integration FORCE ROW LEVEL SECURITY;`);
    await client.query(`
      CREATE POLICY tenant_iso ON test_rls_integration
      FOR ALL
      USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
      WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);
    `);

    await client.query(`DROP ROLE IF EXISTS rls_test_user;`);
    await client.query(`CREATE ROLE rls_test_user NOLOGIN;`);
    await client.query(`GRANT ALL ON test_rls_integration TO rls_test_user;`);

    // 2. Seed data
    const tenantA = '00000000-0000-0000-0000-000000000001';
    const tenantB = '00000000-0000-0000-0000-000000000002';

    await client.query(`INSERT INTO test_rls_integration (tenant_id, data) VALUES ($1, $2)`, [tenantA, 'Data for A'], tenantA);
    await client.query(`INSERT INTO test_rls_integration (tenant_id, data) VALUES ($1, $2)`, [tenantB, 'Data for B'], tenantB);

    // 3. Negative Test (Read)
    await client.transaction(async (conn) => {
      await conn.query(`SET LOCAL ROLE rls_test_user;`);
      const resultA = await conn.query(`SELECT * FROM test_rls_integration`) as { rows: any[] };
      assert.strictEqual(resultA.rows.length, 1);
      assert.strictEqual(resultA.rows[0]!.data, 'Data for A');
    }, tenantA);

    await client.transaction(async (conn) => {
      await conn.query(`SET LOCAL ROLE rls_test_user;`);
      const resultB = await conn.query(`SELECT * FROM test_rls_integration`) as { rows: any[] };
      assert.strictEqual(resultB.rows.length, 1);
      assert.strictEqual(resultB.rows[0]!.data, 'Data for B');
    }, tenantB);

    // 4. Negative Test (Write)
    // Tenant B tries to update Tenant A's row. It should affect 0 rows.
    await client.transaction(async (conn) => {
      await conn.query(`SET LOCAL ROLE rls_test_user;`);
      const updateResult = await conn.query(`UPDATE test_rls_integration SET data = 'Hacked' WHERE tenant_id = $1`, [tenantA]);
      assert.strictEqual(updateResult.rowCount, 0, 'Tenant B should not be able to update Tenant A data');
    }, tenantB);

    // 5. Teardown
    await client.query(`DROP TABLE test_rls_integration;`);
    await client.query(`DROP ROLE rls_test_user;`);
  });

  await client.shutdown();
});
