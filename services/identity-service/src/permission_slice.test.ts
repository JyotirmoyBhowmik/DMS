import { describe, test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { PermissionAggregate, PermissionDomainError, InvalidPermissionStateTransitionError } from './domain/entities/permission.entity.js';
import { validateCreatePermissionInput, validateUpdatePermissionInput } from './domain/validation/permission.validation.js';
import { PermissionPgRepository } from './infrastructure/database/repositories/permission.pg-repository.js';
import { CreatePermissionUseCase } from './application/usecases/create-permission.usecase.js';
import { GetPermissionUseCase } from './application/usecases/get-permission.usecase.js';
import { UpdatePermissionUseCase } from './application/usecases/update-permission.usecase.js';
import { ListPermissionsUseCase } from './application/usecases/list-permissions.usecase.js';
import { PermissionController } from './presentation/rest/controllers/permission.controller.js';
import { PermissionAuditService } from './infrastructure/audit/permission.audit.js';
import { PermissionEventConsumer } from './infrastructure/events/permission.consumer.js';

describe('Permission Full Vertical Slice QA & Security Suite (Tasks 1483-1501)', () => {
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
    PermissionAuditService.clearAuditLogs();
  });

  describe('Task 1492: Permission Event Consumer & DLQ Handling', () => {
    test('deduplicates events by ID and routes poison messages to DLQ', async () => {
      const consumer = new PermissionEventConsumer();

      const validEvent = {
        id: 'evt-perm-100',
        name: 'identity.permission.created',
        tenantId: tenantA,
        occurredAt: new Date().toISOString(),
        payload: { name: 'finance:invoice:read' },
      };

      const res1 = await consumer.consume(validEvent);
      assert.equal(res1.success, true);

      // Duplicate event
      const res2 = await consumer.consume(validEvent);
      assert.equal(res2.success, true);
      assert.equal(res2.reason, 'DUPLICATE_SKIPPED');

      // Poison event
      const resPoison = await consumer.consume({ id: '', name: 'invalid', tenantId: '', occurredAt: '' } as any);
      assert.equal(resPoison.success, false);
      assert.equal(resPoison.reason, 'POISON_EVENT');
      assert.equal(consumer.getDlqMessages().length, 1);
    });
  });

  describe('Task 1484 & 1498: Permission Domain Entity & Invariants', () => {
    test('enforces constructor invariants: tenantId, non-empty name, resource, action', () => {
      const perm = new PermissionAggregate({
        tenantId: tenantA,
        name: 'inventory:stock:write',
        resource: 'inventory',
        action: 'write',
        description: 'Grants write access to inventory stock',
      });

      assert.equal(perm.name, 'inventory:stock:write');
      assert.equal(perm.status, 'ACTIVE');

      assert.throws(() => {
        new PermissionAggregate({
          tenantId: tenantA,
          name: '',
          resource: 'inv',
          action: 'read',
        });
      }, /name is required/);
    });

    test('executes valid state transitions and rejects illegal ones', () => {
      const perm = new PermissionAggregate({
        tenantId: tenantA,
        name: 'orders:create',
        resource: 'orders',
        action: 'create',
      });

      perm.deactivate();
      assert.equal(perm.status, 'INACTIVE');

      perm.activate();
      assert.equal(perm.status, 'ACTIVE');

      perm.deprecate();
      assert.equal(perm.status, 'DEPRECATED');

      assert.throws(() => {
        perm.activate();
      }, InvalidPermissionStateTransitionError);
    });
  });

  describe('Task 1490: Permission Domain Validation Rules', () => {
    test('validates Create input and rejects unknown fields (mass assignment defense)', () => {
      const valid = validateCreatePermissionInput({
        name: 'reports:export',
        resource: 'reports',
        action: 'export',
        description: 'Export sales reports',
      });
      assert.equal(valid.name, 'reports:export');

      assert.throws(() => {
        validateCreatePermissionInput({
          name: 'reports:export',
          resource: 'reports',
          action: 'export',
          unauthorizedGrant: true,
        });
      }, /Unknown field 'unauthorizedGrant' is not allowed/);
    });

    test('validates Update input and version field', () => {
      const valid = validateUpdatePermissionInput({
        status: 'INACTIVE',
        version: 1,
      });
      assert.equal(valid.status, 'INACTIVE');

      assert.throws(() => {
        validateUpdatePermissionInput({
          status: 'INVALID_STATUS',
          version: 1,
        });
      }, /status must be one of: ACTIVE, INACTIVE, DEPRECATED/);
    });
  });

  describe('Task 1486-1489 & 1499: Permission Use Cases & Audit Trail', () => {
    test('executes CreatePermissionUseCase with idempotency & audit trail', async () => {
      const repository = new PermissionPgRepository();
      const createUseCase = new CreatePermissionUseCase(repository);

      const dto = {
        name: 'claims:approve',
        resource: 'claims',
        action: 'approve',
        idempotencyKey: 'idemp-perm-201',
      };

      const created = await createUseCase.execute(adminPrincipalTenantA, dto, 'idemp-perm-201', 'corr-perm-1');
      assert.equal(created.name, 'claims:approve');

      // Idempotent retry returns identical instance
      const retried = await createUseCase.execute(adminPrincipalTenantA, dto, 'idemp-perm-201', 'corr-perm-1');
      assert.equal(retried.id, created.id);

      const logs = PermissionAuditService.getAuditLogs();
      assert.equal(logs.length, 1);
      assert.equal(logs[0].action, 'PERMISSION_CREATED');
    });

    test('executes Get, Update and List use cases with optimistic locking', async () => {
      const repository = new PermissionPgRepository(undefined, new Map());
      const createUseCase = new CreatePermissionUseCase(repository);
      const getUseCase = new GetPermissionUseCase(repository);
      const updateUseCase = new UpdatePermissionUseCase(repository);
      const listUseCase = new ListPermissionsUseCase(repository);

      const created = await createUseCase.execute(adminPrincipalTenantA, {
        name: 'schemes:manage',
        resource: 'schemes',
        action: 'manage',
      });

      const fetched = await getUseCase.execute(created.id, adminPrincipalTenantA);
      assert.equal(fetched.name, 'schemes:manage');

      const updated = await updateUseCase.execute(created.id, adminPrincipalTenantA, {
        name: 'schemes:manage:v2',
        version: 1,
      });
      assert.equal(updated.name, 'schemes:manage:v2');
      assert.equal(updated.version, 2);

      // Optimistic concurrency conflict on stale version 1
      await assert.rejects(async () => {
        await updateUseCase.execute(created.id, adminPrincipalTenantA, {
          name: 'Conflict Update',
          version: 1,
        });
      }, /Optimistic locking conflict/);

      const listResult = await listUseCase.execute(adminPrincipalTenantA);
      assert.equal(listResult.total, 1);
    });

    test('rejects unauthorized principals', async () => {
      const repository = new PermissionPgRepository();
      const getUseCase = new GetPermissionUseCase(repository);

      const unprivileged = {
        userId: 'user-guest',
        tenantId: tenantA,
        roles: ['guest'],
        permissions: [],
      };

      await assert.rejects(async () => {
        await getUseCase.execute('some-id', unprivileged);
      }, /Forbidden: Insufficient permissions/);
    });
  });

  describe('Task 1485 & 1500: Repository RLS Isolation Proof', () => {
    test('enforces tenant RLS isolation between Tenant A and Tenant B', async () => {
      const repository = new PermissionPgRepository();
      const createUseCase = new CreatePermissionUseCase(repository);
      const getUseCase = new GetPermissionUseCase(repository);

      const createdA = await createUseCase.execute(adminPrincipalTenantA, {
        name: 'Tenant A Permission',
        resource: 'resA',
        action: 'read',
      });

      const createdB = await createUseCase.execute(adminPrincipalTenantB, {
        name: 'Tenant B Permission',
        resource: 'resB',
        action: 'read',
      });

      // Tenant A cannot read Tenant B record
      await assert.rejects(async () => {
        await getUseCase.execute(createdB.id, adminPrincipalTenantA);
      }, /Permission with id .* not found/);
    });
  });

  describe('Task 1493 & 1501: Permission Controller REST API & Security', () => {
    test('handles controller CRUD endpoints with correct HTTP status codes', async () => {
      const repository = new PermissionPgRepository();
      const createUseCase = new CreatePermissionUseCase(repository);
      const getUseCase = new GetPermissionUseCase(repository);
      const updateUseCase = new UpdatePermissionUseCase(repository);
      const listUseCase = new ListPermissionsUseCase(repository);

      const controller = new PermissionController(createUseCase, getUseCase, updateUseCase, listUseCase);

      const req = {
        headers: {
          'x-tenant-id': tenantA,
          'x-user-id': 'admin-1',
          'x-user-roles': 'admin',
          'x-user-permissions': 'identity:*',
          'content-type': 'application/json',
        },
        body: {
          name: 'API Permission',
          resource: 'api',
          action: 'access',
          description: 'Created via REST API',
        },
        query: {},
        params: {},
      };

      let statusCode = 0;
      let jsonPayload: any = null;
      const res = {
        status: (code: number) => {
          statusCode = code;
          return res;
        },
        json: (data: any) => {
          jsonPayload = data;
        },
      };

      await controller.create(req, res);
      assert.equal(statusCode, 201);
      assert.equal(jsonPayload.success, true);
      assert.equal(jsonPayload.data.name, 'API Permission');
    });

    test('rejects unsupported content-type', async () => {
      const repository = new PermissionPgRepository();
      const controller = new PermissionController(
        new CreatePermissionUseCase(repository),
        new GetPermissionUseCase(repository),
        new UpdatePermissionUseCase(repository),
        new ListPermissionsUseCase(repository)
      );

      const req = {
        headers: {
          'content-type': 'text/plain',
        },
        body: 'invalid',
      };

      let statusCode = 0;
      let jsonPayload: any = null;
      const res = {
        status: (code: number) => {
          statusCode = code;
          return res;
        },
        json: (data: any) => {
          jsonPayload = data;
        },
      };

      await controller.create(req, res);
      assert.equal(statusCode, 415);
      assert.equal(jsonPayload.success, false);
      assert.equal(jsonPayload.error.message, 'Unsupported Media Type: Content-Type must be application/json');
    });
  });
});
