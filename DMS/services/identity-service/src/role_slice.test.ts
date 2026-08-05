import { describe, test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { RoleAggregate, RoleDomainError, InvalidRoleStateTransitionError } from './domain/entities/role.entity.js';
import { validateCreateRoleInput, validateUpdateRoleInput } from './domain/validation/role.validation.js';
import { RolePgRepository } from './infrastructure/database/repositories/role.pg-repository.js';
import { CreateRoleUseCase } from './application/usecases/create-role.usecase.js';
import { GetRoleUseCase } from './application/usecases/get-role.usecase.js';
import { UpdateRoleUseCase } from './application/usecases/update-role.usecase.js';
import { ListRolesUseCase } from './application/usecases/list-roles.usecase.js';
import { RoleController } from './presentation/rest/controllers/role.controller.js';
import { RoleAuditService } from './infrastructure/audit/role.audit.js';
import { RoleEventConsumer } from './infrastructure/events/role.consumer.js';

describe('Role Full Vertical Slice QA & Security Suite (Tasks 1462-1480)', () => {
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
    RolePgRepository.clearInMemoryStore();
    RoleAuditService.clearAuditLogs();
  });

  describe('Task 1471: Role Event Consumer & DLQ Handling', () => {
    test('deduplicates events by ID and routes poison messages to DLQ', async () => {
      const consumer = new RoleEventConsumer();

      const validEvent = {
        id: 'evt-role-100',
        name: 'identity.role.created',
        tenantId: tenantA,
        occurredAt: new Date().toISOString(),
        payload: { name: 'Regional Manager' },
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

  describe('Task 1463 & 1477: Role Domain Entity & Invariants', () => {
    test('enforces constructor invariants: tenantId, non-empty name, system role protection', () => {
      const role = new RoleAggregate({
        tenantId: tenantA,
        name: 'Regional Admin',
        description: 'Manages regional territory',
      });

      assert.equal(role.name, 'Regional Admin');
      assert.equal(role.status, 'ACTIVE');

      assert.throws(() => {
        new RoleAggregate({
          tenantId: tenantA,
          name: '',
        });
      }, /name is required/);
    });

    test('executes valid state transitions and protects system roles', () => {
      const role = new RoleAggregate({
        tenantId: tenantA,
        name: 'Sales Supervisor',
      });

      role.deactivate();
      assert.equal(role.status, 'INACTIVE');

      role.activate();
      assert.equal(role.status, 'ACTIVE');

      role.archive();
      assert.equal(role.status, 'ARCHIVED');

      const systemRole = new RoleAggregate({
        tenantId: tenantA,
        name: 'SuperAdmin',
        isSystem: true,
      });

      assert.throws(() => {
        systemRole.archive();
      }, InvalidRoleStateTransitionError);
    });
  });

  describe('Task 1469: Role Domain Validation Rules', () => {
    test('validates Create input and rejects unknown fields (mass assignment defense)', () => {
      const valid = validateCreateRoleInput({
        name: 'Area Manager',
        description: 'Manages area sales',
      });
      assert.equal(valid.name, 'Area Manager');

      assert.throws(() => {
        validateCreateRoleInput({
          name: 'Area Manager',
          isSuperUserOverride: true,
        });
      }, /Unknown field 'isSuperUserOverride' is not allowed/);
    });

    test('validates Update input and version field', () => {
      const valid = validateUpdateRoleInput({
        status: 'INACTIVE',
        version: 1,
      });
      assert.equal(valid.status, 'INACTIVE');

      assert.throws(() => {
        validateUpdateRoleInput({
          status: 'INVALID_STATUS',
          version: 1,
        });
      }, /status must be one of: ACTIVE, INACTIVE, ARCHIVED/);
    });
  });

  describe('Task 1465-1468 & 1478: Role Use Cases & Audit Trail', () => {
    test('executes CreateRoleUseCase with idempotency & audit trail', async () => {
      const repository = new RolePgRepository();
      const createUseCase = new CreateRoleUseCase(repository);

      const dto = {
        name: 'Inventory Auditor',
        idempotencyKey: 'idemp-role-201',
      };

      const created = await createUseCase.execute(adminPrincipalTenantA, dto, 'idemp-role-201', 'corr-role-1');
      assert.equal(created.name, 'Inventory Auditor');

      // Idempotent retry returns identical instance
      const retried = await createUseCase.execute(adminPrincipalTenantA, dto, 'idemp-role-201', 'corr-role-1');
      assert.equal(retried.id, created.id);

      const logs = RoleAuditService.getAuditLogs();
      assert.equal(logs.length, 1);
      assert.equal(logs[0].action, 'ROLE_CREATED');
    });

    test('executes Get, Update and List use cases with optimistic locking', async () => {
      const repository = new RolePgRepository();
      const createUseCase = new CreateRoleUseCase(repository);
      const getUseCase = new GetRoleUseCase(repository);
      const updateUseCase = new UpdateRoleUseCase(repository);
      const listUseCase = new ListRolesUseCase(repository);

      const created = await createUseCase.execute(adminPrincipalTenantA, {
        name: 'Warehouse Lead',
      });

      const fetched = await getUseCase.execute(created.id, adminPrincipalTenantA);
      assert.equal(fetched.name, 'Warehouse Lead');

      const updated = await updateUseCase.execute(created.id, adminPrincipalTenantA, {
        name: 'Senior Warehouse Lead',
        version: 1,
      });
      assert.equal(updated.name, 'Senior Warehouse Lead');
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
      const repository = new RolePgRepository();
      const getUseCase = new GetRoleUseCase(repository);

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

  describe('Task 1464 & 1479: Repository RLS Isolation Proof', () => {
    test('enforces tenant RLS isolation between Tenant A and Tenant B', async () => {
      const repository = new RolePgRepository();
      const createUseCase = new CreateRoleUseCase(repository);
      const getUseCase = new GetRoleUseCase(repository);

      const createdA = await createUseCase.execute(adminPrincipalTenantA, {
        name: 'Tenant A Role',
      });

      const createdB = await createUseCase.execute(adminPrincipalTenantB, {
        name: 'Tenant B Role',
      });

      // Tenant A cannot read Tenant B record
      await assert.rejects(async () => {
        await getUseCase.execute(createdB.id, adminPrincipalTenantA);
      }, /Role with id .* not found/);
    });
  });

  describe('Task 1472 & 1480: Role Controller REST API & Security', () => {
    test('handles controller CRUD endpoints with correct HTTP status codes', async () => {
      const repository = new RolePgRepository();
      const createUseCase = new CreateRoleUseCase(repository);
      const getUseCase = new GetRoleUseCase(repository);
      const updateUseCase = new UpdateRoleUseCase(repository);
      const listUseCase = new ListRolesUseCase(repository);

      const controller = new RoleController(createUseCase, getUseCase, updateUseCase, listUseCase);

      const req = {
        headers: {
          'x-tenant-id': tenantA,
          'x-user-id': 'admin-1',
          'x-user-roles': 'admin',
          'x-user-permissions': 'identity:*',
          'content-type': 'application/json',
        },
        body: {
          name: 'API Admin Role',
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
      assert.equal(jsonPayload.data.name, 'API Admin Role');
    });

    test('rejects unsupported content-type', async () => {
      const repository = new RolePgRepository();
      const controller = new RoleController(
        new CreateRoleUseCase(repository),
        new GetRoleUseCase(repository),
        new UpdateRoleUseCase(repository),
        new ListRolesUseCase(repository)
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
