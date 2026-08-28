import { describe, test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  UserAggregate,
  UserDomainError,
  InvalidUserStateTransitionError,
} from './domain/entities/user.entity.js';
import {
  validateCreateUserInput,
  validateUpdateUserInput,
} from './domain/validation/user.validation.js';
import { UserPgRepository } from './infrastructure/database/repositories/user.pg-repository.js';
import { CreateUserUseCase } from './application/usecases/create-user.usecase.js';
import { GetUserUseCase } from './application/usecases/get-user.usecase.js';
import { UpdateUserUseCase } from './application/usecases/update-user.usecase.js';
import { ListUsersUseCase } from './application/usecases/list-users.usecase.js';
import { UserController } from './presentation/rest/controllers/user.controller.js';
import { UserAuditService } from './infrastructure/audit/user.audit.js';
import { UserEventConsumer } from './infrastructure/events/user.consumer.js';

describe('User Full Vertical Slice QA & Security Suite (Tasks 1441-1459)', () => {
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
    UserPgRepository.clearInMemoryStore();
    UserAuditService.clearAuditLogs();
  });

  describe('Task 1450: User Event Consumer & DLQ Handling', () => {
    test('deduplicates events by ID and routes poison messages to DLQ', async () => {
      const consumer = new UserEventConsumer();

      const validEvent = {
        id: 'evt-usr-100',
        name: 'identity.user.created',
        tenantId: tenantA,
        occurredAt: new Date().toISOString(),
        payload: { email: 'test@example.com' },
      };

      const res1 = await consumer.consume(validEvent);
      assert.equal(res1.success, true);

      // Duplicate event
      const res2 = await consumer.consume(validEvent);
      assert.equal(res2.success, true);
      assert.equal(res2.reason, 'DUPLICATE_SKIPPED');

      // Poison event
      const resPoison = await consumer.consume({
        id: '',
        name: 'invalid',
        tenantId: '',
        occurredAt: '',
      } as any);
      assert.equal(resPoison.success, false);
      assert.equal(resPoison.reason, 'POISON_EVENT');
      assert.equal(consumer.getDlqMessages().length, 1);
    });
  });

  describe('Task 1442 & 1456: User Domain Entity & Invariants', () => {
    test('enforces constructor invariants: tenantId, email format, passwordHash non-empty', () => {
      const user = new UserAggregate({
        tenantId: tenantA,
        email: 'john.doe@example.com',
        passwordHash: '$2b$10$hashedPasswordValue',
      });

      assert.equal(user.email, 'john.doe@example.com');
      assert.equal(user.status, 'ACTIVE');

      assert.throws(() => {
        new UserAggregate({
          tenantId: tenantA,
          email: 'invalid-email-format',
          passwordHash: 'hash',
        });
      }, /Invalid email format/);

      assert.throws(() => {
        new UserAggregate({
          tenantId: tenantA,
          email: 'valid@example.com',
          passwordHash: '',
        });
      }, /passwordHash is required/);
    });

    test('executes valid state transitions and rejects illegal ones', () => {
      const user = new UserAggregate({
        tenantId: tenantA,
        email: 'state.user@example.com',
        passwordHash: 'hash123',
      });

      user.suspend();
      assert.equal(user.status, 'SUSPENDED');

      user.activate();
      assert.equal(user.status, 'ACTIVE');

      user.lock();
      assert.equal(user.status, 'LOCKED');

      assert.throws(() => {
        user.deactivate();
      }, InvalidUserStateTransitionError);
    });

    test('redacts sensitive passwordHash when calling toJSON() by default', () => {
      const user = new UserAggregate({
        tenantId: tenantA,
        email: 'secret@example.com',
        passwordHash: 'superSecretHashValue',
      });

      const publicJson = user.toJSON(true);
      assert.equal((publicJson as any).passwordHash, undefined);

      const internalJson = user.toJSON(false);
      assert.equal((internalJson as any).passwordHash, 'superSecretHashValue');
    });
  });

  describe('Task 1448: User Domain Validation Rules', () => {
    test('validates Create input and rejects unknown fields (mass assignment defense)', () => {
      const valid = validateCreateUserInput({
        email: 'valid.user@domain.com',
        passwordHash: 'secretHash',
      });
      assert.equal(valid.email, 'valid.user@domain.com');

      assert.throws(() => {
        validateCreateUserInput({
          email: 'valid.user@domain.com',
          passwordHash: 'secretHash',
          isAdminOverride: true,
        });
      }, /Unknown field 'isAdminOverride' is not allowed/);
    });

    test('validates Update input and version field', () => {
      const valid = validateUpdateUserInput({
        status: 'SUSPENDED',
        version: 1,
      });
      assert.equal(valid.status, 'SUSPENDED');

      assert.throws(() => {
        validateUpdateUserInput({
          status: 'INVALID_STATUS',
          version: 1,
        });
      }, /status must be one of: ACTIVE, INACTIVE, SUSPENDED, LOCKED/);
    });
  });

  describe('Task 1444-1447 & 1457: User Use Cases & Audit Trail', () => {
    test('executes CreateUserUseCase with idempotency & audit trail', async () => {
      const repository = new UserPgRepository();
      const createUseCase = new CreateUserUseCase(repository);

      const dto = {
        email: 'new.user@example.com',
        passwordHash: 'hash321',
        idempotencyKey: 'idemp-usr-201',
      };

      const created = await createUseCase.execute(
        adminPrincipalTenantA,
        dto,
        'idemp-usr-201',
        'corr-usr-1',
      );
      assert.equal(created.email, 'new.user@example.com');

      // Idempotent retry returns identical instance
      const retried = await createUseCase.execute(
        adminPrincipalTenantA,
        dto,
        'idemp-usr-201',
        'corr-usr-1',
      );
      assert.equal(retried.id, created.id);

      const logs = UserAuditService.getAuditLogs();
      assert.equal(logs.length, 1);
      assert.equal(logs[0].action, 'USER_CREATED');
    });

    test('executes Get, Update and List use cases with optimistic locking', async () => {
      const repository = new UserPgRepository();
      const createUseCase = new CreateUserUseCase(repository);
      const getUseCase = new GetUserUseCase(repository);
      const updateUseCase = new UpdateUserUseCase(repository);
      const listUseCase = new ListUsersUseCase(repository);

      const created = await createUseCase.execute(adminPrincipalTenantA, {
        email: 'update.user@example.com',
        passwordHash: 'hash999',
      });

      const fetched = await getUseCase.execute(created.id, adminPrincipalTenantA);
      assert.equal(fetched.email, 'update.user@example.com');

      const updated = await updateUseCase.execute(created.id, adminPrincipalTenantA, {
        status: 'SUSPENDED',
        version: 1,
      });
      assert.equal(updated.status, 'SUSPENDED');
      assert.equal(updated.version, 2);

      // Optimistic concurrency conflict on stale version 1
      await assert.rejects(async () => {
        await updateUseCase.execute(created.id, adminPrincipalTenantA, {
          status: 'ACTIVE',
          version: 1,
        });
      }, /Optimistic locking conflict/);

      const listResult = await listUseCase.execute(adminPrincipalTenantA);
      assert.equal(listResult.total, 1);
    });

    test('rejects unauthorized principals', async () => {
      const repository = new UserPgRepository();
      const getUseCase = new GetUserUseCase(repository);

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

  describe('Task 1443 & 1458: Repository RLS Isolation Proof', () => {
    test('enforces tenant RLS isolation between Tenant A and Tenant B', async () => {
      const repository = new UserPgRepository();
      const createUseCase = new CreateUserUseCase(repository);
      const getUseCase = new GetUserUseCase(repository);

      const createdA = await createUseCase.execute(adminPrincipalTenantA, {
        email: 'tenant.a.user@example.com',
        passwordHash: 'hashA',
      });

      const createdB = await createUseCase.execute(adminPrincipalTenantB, {
        email: 'tenant.b.user@example.com',
        passwordHash: 'hashB',
      });

      // Tenant A cannot read Tenant B record
      await assert.rejects(async () => {
        await getUseCase.execute(createdB.id, adminPrincipalTenantA);
      }, /User with id .* not found/);
    });
  });

  describe('Task 1451 & 1459: User Controller REST API & Security', () => {
    test('handles controller CRUD endpoints with correct HTTP status codes', async () => {
      const repository = new UserPgRepository();
      const createUseCase = new CreateUserUseCase(repository);
      const getUseCase = new GetUserUseCase(repository);
      const updateUseCase = new UpdateUserUseCase(repository);
      const listUseCase = new ListUsersUseCase(repository);

      const controller = new UserController(createUseCase, getUseCase, updateUseCase, listUseCase);

      const req = {
        headers: {
          'x-tenant-id': tenantA,
          'x-user-id': 'admin-1',
          'x-user-roles': 'admin',
          'x-user-permissions': 'identity:*',
          'content-type': 'application/json',
        },
        body: {
          email: 'api.ctrl.user@example.com',
          passwordHash: 'hashCtrl100',
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
      assert.equal(jsonPayload.data.email, 'api.ctrl.user@example.com');
      // Password hash must be redacted from response payload!
      assert.equal(jsonPayload.data.passwordHash, undefined);
    });

    test('rejects unsupported content-type', async () => {
      const repository = new UserPgRepository();
      const controller = new UserController(
        new CreateUserUseCase(repository),
        new GetUserUseCase(repository),
        new UpdateUserUseCase(repository),
        new ListUsersUseCase(repository),
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
      assert.equal(
        jsonPayload.error.message,
        'Unsupported Media Type: Content-Type must be application/json',
      );
    });
  });
});
