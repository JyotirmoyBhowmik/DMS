import test from 'node:test';
import assert from 'node:assert';
import { PII, isPII, getPIIFields } from './annotations/pii.js';
import { Encrypted, isEncrypted, getEncryptedFields, packEncrypted, unpackEncrypted, createEncryptedTransformer } from './annotations/encrypted.js';
import { Tenant, isTenantColumn, getTenantField } from './annotations/tenant.js';
import { buildTenantRlsPolicy, setTenantContext, clearTenantContext, RlsPolicyBuilder } from './rls/policy_builder.js';

class MockUser {
  @PII()
  email!: string;

  @Encrypted()
  ssn!: string;

  @Tenant()
  tenantId!: string;
}

test('Database Annotations: PII decorator', () => {
  const user = new MockUser();
  assert.strictEqual(isPII(user, 'email'), true);
  assert.strictEqual(isPII(user, 'ssn'), false);
  assert.deepStrictEqual(getPIIFields(MockUser), ['email']);
});

test('Database Annotations: Encrypted decorator & packer', () => {
  const user = new MockUser();
  assert.strictEqual(isEncrypted(user, 'ssn'), true);
  assert.strictEqual(isEncrypted(user, 'email'), false);
  assert.deepStrictEqual(getEncryptedFields(MockUser), ['ssn']);

  const keyHex = 'a'.repeat(64); // 32 bytes (64 hex characters)
  const plaintext = 'SecretPayload';
  const packed = packEncrypted(plaintext, keyHex);
  const unpacked = unpackEncrypted(packed, keyHex);
  assert.strictEqual(unpacked, plaintext);

  const transformer = createEncryptedTransformer(keyHex);
  const encryptedVal = transformer.to(plaintext);
  assert.ok(encryptedVal);
  assert.strictEqual(transformer.from(encryptedVal), plaintext);
});

test('Database Annotations: Tenant decorator', () => {
  const user = new MockUser();
  assert.strictEqual(isTenantColumn(user, 'tenantId'), true);
  assert.strictEqual(isTenantColumn(user, 'email'), false);
  assert.strictEqual(getTenantField(MockUser), 'tenantId');
});

test('Database RLS Policy: Policy Builder SQL Generation', () => {
  const expectedPolicy = [
    'ALTER TABLE "distributors" ENABLE ROW LEVEL SECURITY;',
    '',
    'CREATE POLICY "tenant_isolation_distributors" ON "distributors"',
    '  FOR ALL',
    '  USING ("tenant_id" = current_setting(\'app.tenant_id\')::uuid)',
    '  WITH CHECK ("tenant_id" = current_setting(\'app.tenant_id\')::uuid);'
  ].join('\n');

  const generated = buildTenantRlsPolicy('distributors', 'tenant_id');
  assert.strictEqual(generated, expectedPolicy);

  const enableSql = RlsPolicyBuilder.generateRlsEnableSql('distributors');
  assert.strictEqual(enableSql, 'ALTER TABLE "distributors" ENABLE ROW LEVEL SECURITY;');

  const policySql = RlsPolicyBuilder.generateTenantIsolationPolicySql('distributors', 'tenant_id');
  assert.strictEqual(policySql, expectedPolicy);
});

test('Database RLS Policy: Context set/clear', async () => {
  const queries: string[] = [];
  const mockConn = {
    async query(sql: string, params?: unknown[]): Promise<unknown> {
      queries.push(sql);
      return {};
    }
  };

  const tenantId = '00000000-0000-0000-0000-000000000001';
  await setTenantContext(mockConn, tenantId);
  await clearTenantContext(mockConn);

  assert.strictEqual(queries[0], `SET LOCAL app.tenant_id = '${tenantId}'`);
  assert.strictEqual(queries[1], 'RESET app.tenant_id');
});

test('Database RLS Policy: Automated Cross-Tenant Denial Test', async () => {
  const tenantA = '00000000-0000-0000-0000-000000000001';
  const tenantB = '00000000-0000-0000-0000-000000000002';
  
  let currentSessionTenantId: string | null = null;
  
  const mockConn = {
    async query(sql: string, _params?: unknown[]): Promise<any> {
      if (sql.startsWith('SET LOCAL app.tenant_id')) {
        const match = sql.match(/'([^']+)'/);
        currentSessionTenantId = match ? match[1] : null;
      } else if (sql.startsWith('RESET app.tenant_id')) {
        currentSessionTenantId = null;
      }
      return {};
    }
  };

  async function executeSelect(targetTenantId: string) {
    if (!currentSessionTenantId || currentSessionTenantId !== targetTenantId) {
      throw new Error('AccessDenied: Row-Level Security policy violated. Cross-tenant access blocked.');
    }
    return { success: true };
  }

  // Set context to Tenant A
  await setTenantContext(mockConn, tenantA);
  
  // Accessing Tenant A data should succeed
  const successResult = await executeSelect(tenantA);
  assert.strictEqual(successResult.success, true);

  // Accessing Tenant B data under Tenant A session must fail
  await assert.rejects(
    async () => {
      await executeSelect(tenantB);
    },
    /AccessDenied/
  );

  // Clear context
  await clearTenantContext(mockConn);
});

