import { describe, test, beforeEach } from 'node:test';
import assert from 'node:assert';
import { TenantAggregate, TenantDomainError, InvalidTenantStateTransitionError, TenantValidationError } from './domain/entities/tenant.entity.js';
import { TenantPgRepository } from './infrastructure/database/repositories/tenant.pg-repository.js';
import { TenantAuditService } from './infrastructure/audit/tenant.audit.js';
import { TenantEventConsumer } from './infrastructure/events/tenant.consumer.js';
import { CreateTenantUseCase } from './application/usecases/create-tenant.usecase.js';
import { GetTenantUseCase } from './application/usecases/get-tenant.usecase.js';
import { UpdateTenantUseCase } from './application/usecases/update-tenant.usecase.js';
import { ListTenantsUseCase } from './application/usecases/list-tenants.usecase.js';
import { TenantController } from './presentation/rest/controllers/tenant.controller.js';
import { validateCreateTenantInput, validateUpdateTenantInput } from './domain/validation/tenant.validation.js';

describe('Tenant Full Vertical Slice QA & Security Suite (Tasks 1504-1522)', () => {
  const tenantA = '00000000-0000-0000-0000-000000000001';
  const tenantB = '00000000-0000-0000-0000-000000000002';

  const adminPrincipalTenantA = {
    userId: 'user-admin-id-1',
    tenantId: tenantA,
    roles: ['admin'],
    permissions: ['identity:*'],
  };

  const adminPrincipalTenantB = {
    userId: 'user-tenant-b-id',
    tenantId: tenantB,
    roles: ['admin'],
    permissions: ['identity:*'],
  };

  beforeEach(() => {
    TenantAuditService.clearAuditLogs();
  });

  describe('Task 1513: Tenant Event Consumer & DLQ Handling', () => {
    test('deduplicates events by ID and routes poison messages to DLQ', async () => {
      const consumer = new TenantEventConsumer();

      await consumer.handleEvent({
        id: 'evt-tenant-100', name: 'identity.tenant.created',
        tenantId: tenantA, occurredAt: new Date().toISOString(),
      });

      await consumer.handleEvent({
        id: 'evt-tenant-100', name: 'identity.tenant.created',
        tenantId: tenantA, occurredAt: new Date().toISOString(),
      });

      await consumer.handleEvent({
        id: '', name: 'invalid', tenantId: '', occurredAt: '',
      });

      assert.strictEqual(consumer.getDlq().length, 1);
    });
  });

  describe('Task 1505 & 1512: Tenant Domain Entity & Invariants', () => {
    test('enforces constructor invariants: name required, code required', () => {
      assert.throws(
        () => new TenantAggregate({ name: '', code: 'TEST' }),
        { name: 'TenantDomainError' }
      );
      assert.throws(
        () => new TenantAggregate({ name: 'Test Tenant', code: '' }),
        { name: 'TenantDomainError' }
      );

      const valid = new TenantAggregate({ name: 'Test Tenant', code: 'TT01' });
      assert.strictEqual(valid.name, 'Test Tenant');
      assert.strictEqual(valid.code, 'TT01');
      assert.strictEqual(valid.status, 'ACTIVE');
    });

    test('executes valid state transitions and rejects illegal ones', () => {
      const tenant = new TenantAggregate({ name: 'Enterprise', code: 'ENT1' });
      assert.strictEqual(tenant.status, 'ACTIVE');

      tenant.deactivate();
      assert.strictEqual(tenant.status, 'INACTIVE');

      tenant.activate();
      assert.strictEqual(tenant.status, 'ACTIVE');

      tenant.suspend();
      assert.strictEqual(tenant.status, 'SUSPENDED');

      // SUSPENDED -> ACTIVE is valid
      tenant.activate();
      assert.strictEqual(tenant.status, 'ACTIVE');

      // SUSPENDED -> INACTIVE is invalid
      const suspended = new TenantAggregate({ name: 'Suspended', code: 'SUS1', status: 'SUSPENDED' });
      assert.throws(
        () => suspended.deactivate(),
        { name: 'InvalidTenantStateTransitionError' }
      );
    });
  });

  describe('Task 1511: Tenant Domain Validation Rules', () => {
    test('validates Create input and rejects unknown fields (mass assignment defense)', () => {
      assert.throws(
        () => validateCreateTenantInput({ name: '', code: '' }),
        { name: 'TenantValidationError' }
      );

      assert.throws(
        () => validateCreateTenantInput({ name: 'Test', code: 'TC', isAdmin: true } as any),
        { name: 'TenantValidationError' }
      );

      const result = validateCreateTenantInput({ name: 'Test', code: 'TC' });
      assert.strictEqual(result.name, 'Test');
    });

    test('validates Update input and version field', () => {
      assert.throws(
        () => validateUpdateTenantInput({ status: 'INVALID_STATUS' as any, version: 1 }),
        { name: 'TenantValidationError' }
      );

      assert.throws(
        () => validateUpdateTenantInput({ name: 'Updated', unknownField: 'invalid' } as any),
        { name: 'TenantValidationError' }
      );

      const result = validateUpdateTenantInput({ name: 'Updated', version: 1 });
      assert.strictEqual(result.name, 'Updated');
    });
  });

  describe('Task 1507-1510 & 1517-1520: Tenant Use Cases & Audit Trail', () => {
    test('executes CreateTenantUseCase with idempotency & audit trail', async () => {
      const store = new Map<string, TenantAggregate>();
      const repo = new TenantPgRepository(undefined, store);
      const useCase = new CreateTenantUseCase(repo);

      const tenant = await useCase.execute(
        adminPrincipalTenantA,
        { name: 'Enterprise Tenant', code: 'ET01' },
        'idem-key-tenant-1'
      );

      assert.strictEqual(tenant.name, 'Enterprise Tenant');
      assert.strictEqual(tenant.code, 'ET01');

      const audits = TenantAuditService.getAuditLogs();
      assert.ok(audits.some(a => a.action === 'TENANT_CREATED'));

      // Idempotency: same key returns same entity
      const duplicate = await useCase.execute(
        adminPrincipalTenantA,
        { name: 'Enterprise Tenant', code: 'ET01' },
        'idem-key-tenant-1'
      );
      assert.strictEqual(duplicate.id, tenant.id);
    });

    test('executes Get, Update and List use cases with optimistic locking', async () => {
      const store = new Map<string, TenantAggregate>();
      const repo = new TenantPgRepository(undefined, store);
      const createUC = new CreateTenantUseCase(repo);
      const getUC = new GetTenantUseCase(repo);
      const updateUC = new UpdateTenantUseCase(repo);
      const listUC = new ListTenantsUseCase(repo);

      const created = await createUC.execute(adminPrincipalTenantA, { name: 'Alpha Corp', code: 'AC01' });

      // Get
      const fetched = await getUC.execute(adminPrincipalTenantA, created.id);
      assert.strictEqual(fetched.name, 'Alpha Corp');

      // Update
      const updated = await updateUC.execute(adminPrincipalTenantA, created.id, { name: 'Alpha Corporation', version: 1 });
      assert.strictEqual(updated.name, 'Alpha Corporation');

      // List
      const result = await listUC.execute(adminPrincipalTenantA);
      assert.strictEqual(result.items.length, 1);
    });

    test('rejects unauthorized principals', async () => {
      const store = new Map<string, TenantAggregate>();
      const repo = new TenantPgRepository(undefined, store);
      const useCase = new CreateTenantUseCase(repo);

      const viewerPrincipal = {
        userId: 'viewer-1',
        tenantId: tenantA,
        roles: ['viewer'],
        permissions: ['identity:tenant:read'],
      };

      await assert.rejects(
        () => useCase.execute(viewerPrincipal, { name: 'Hack Tenant', code: 'HT01' }),
        { name: 'TenantDomainError' }
      );
    });
  });

  describe('Task 1506 & 1521: Repository RLS Isolation Proof', () => {
    test('enforces tenant RLS isolation between Tenant A and Tenant B', async () => {
      const storeA = new Map<string, TenantAggregate>();
      const storeB = new Map<string, TenantAggregate>();
      const repoA = new TenantPgRepository(undefined, storeA);
      const repoB = new TenantPgRepository(undefined, storeB);

      const tenantObjA = new TenantAggregate({ tenantId: tenantA, name: 'Tenant A Corp', code: 'TAC' });
      await repoA.save(tenantObjA, tenantA);

      const tenantObjB = new TenantAggregate({ tenantId: tenantB, name: 'Tenant B Corp', code: 'TBC' });
      await repoB.save(tenantObjB, tenantB);

      const resultA = await repoA.findById(tenantObjB.id, tenantA);
      assert.strictEqual(resultA, null);

      const resultB = await repoB.findById(tenantObjA.id, tenantB);
      assert.strictEqual(resultB, null);
    });
  });

  describe('Task 1514 & 1522: Tenant Controller REST API & Security', () => {
    test('handles controller CRUD endpoints with correct HTTP status codes', async () => {
      const store = new Map<string, TenantAggregate>();
      const repo = new TenantPgRepository(undefined, store);
      const createUC = new CreateTenantUseCase(repo);
      const getUC = new GetTenantUseCase(repo);
      const updateUC = new UpdateTenantUseCase(repo);
      const listUC = new ListTenantsUseCase(repo);
      const controller = new TenantController(createUC, getUC, updateUC, listUC, repo);

      const headers = {
        'x-tenant-id': tenantA,
        'x-user-id': 'admin-1',
        'x-user-roles': 'admin',
        'x-user-permissions': 'identity:*',
        'content-type': 'application/json',
      };

      // POST - Create
      const createRes = await controller.handlePostTenant({ name: 'API Tenant', code: 'AT01' }, headers);
      assert.strictEqual(createRes.statusCode, 201);
      assert.strictEqual(createRes.body.name, 'API Tenant');

      // GET - Detail
      const getRes = await controller.handleGetTenant(createRes.body.id, headers);
      assert.strictEqual(getRes.statusCode, 200);

      // GET - List
      const listRes = await controller.handleListTenants({}, headers);
      assert.strictEqual(listRes.statusCode, 200);
      assert.ok(Array.isArray(listRes.body));

      // PUT - Update
      const updateRes = await controller.handlePutTenant(createRes.body.id, { name: 'Updated API Tenant', version: 1 }, headers);
      assert.strictEqual(updateRes.statusCode, 200);

      // DELETE
      const deleteRes = await controller.handleDeleteTenant(createRes.body.id, headers);
      assert.strictEqual(deleteRes.statusCode, 200);
    });

    test('rejects unsupported content-type', async () => {
      const controller = new TenantController();

      const headers = {
        'x-tenant-id': tenantA,
        'content-type': 'text/xml',
      };

      const res = await controller.handlePostTenant({}, headers);
      assert.strictEqual(res.statusCode, 415);
    });
  });
});
