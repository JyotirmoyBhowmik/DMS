import { describe, test, beforeEach } from 'node:test';
import assert from 'node:assert';
import { FieldRep } from './domain/entities/field-rep.js';
import { FieldRepPgRepository } from './infrastructure/database/repositories/field-rep.pg-repository.js';
import {
  CreateFieldRepUseCase,
  UpdateFieldRepUseCase,
  GetFieldRepUseCase,
  ListFieldRepsUseCase,
} from './application/usecases/field-rep/field-rep.usecases.js';
import { AuditController } from '../../audit-service/src/presentation/rest/controllers/audit.controller.js';

const tenantId = '00000000-0000-0000-0000-000000000001';
const otherTenantId = '00000000-0000-0000-0000-000000000002';
const userId = '00000000-0000-0000-0000-0000000000c1';
const otherUserId = '00000000-0000-0000-0000-0000000000c2';

const adminPrincipal = {
  id: 'admin-user-uuid',
  tenantId,
  roles: ['admin'],
};

const agentPrincipal = {
  id: 'agent-user-uuid',
  tenantId,
  roles: ['agent'],
};

beforeEach(() => {
  FieldRepPgRepository.clearStore();
  AuditController.getInstance().getRepository().clear();
});

describe('SFA FieldRep Slice Tests', () => {
  describe('1. Domain Entity aggregate', () => {
    test('Should create and reconstitute FieldRep and validate invariants', () => {
      const rep = FieldRep.create({
        id: 'rep-1',
        tenantId,
        userId,
        employeeCode: 'EMP001',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@dms.com',
        phone: '1234567890',
      });

      assert.strictEqual(rep.id, 'rep-1');
      assert.strictEqual(rep.tenantId, tenantId);
      assert.strictEqual(rep.userId, userId);
      assert.strictEqual(rep.employeeCode, 'EMP001');
      assert.strictEqual(rep.firstName, 'John');
      assert.strictEqual(rep.lastName, 'Doe');
      assert.strictEqual(rep.email, 'john.doe@dms.com');
      assert.strictEqual(rep.phone, '1234567890');
      assert.strictEqual(rep.status, 'ACTIVE');

      // Invalid ID
      assert.throws(() => {
        FieldRep.create({
          id: '',
          tenantId,
          userId,
          employeeCode: 'EMP001',
          firstName: 'John',
          lastName: 'Doe',
          email: 'john.doe@dms.com',
          phone: '1234567890',
        });
      }, /ID cannot be empty/);

      // Invalid email
      assert.throws(() => {
        FieldRep.create({
          id: 'rep-1',
          tenantId,
          userId,
          employeeCode: 'EMP001',
          firstName: 'John',
          lastName: 'Doe',
          email: 'john.doe_dms.com',
          phone: '1234567890',
        });
      }, /Invalid email format/);
    });

    test('Should enforce state transitions rules', () => {
      const rep = FieldRep.create({
        id: 'rep-1',
        tenantId,
        userId,
        employeeCode: 'EMP001',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@dms.com',
        phone: '1234567890',
      });

      // Update info
      rep.updateInfo({ firstName: 'Johnny' });
      assert.strictEqual(rep.firstName, 'Johnny');

      // Deactivate
      rep.deactivate();
      assert.strictEqual(rep.status, 'INACTIVE');

      // Suspend
      rep.suspend();
      assert.strictEqual(rep.status, 'SUSPENDED');

      // Terminate
      rep.terminate();
      assert.strictEqual(rep.status, 'TERMINATED');

      // Cannot update details once terminated
      assert.throws(() => {
        rep.updateInfo({ firstName: 'Denied' });
      }, /Cannot update details of a terminated representative/);
    });
  });

  describe('2. Postgres Repository implementation', () => {
    test('Should save, find, and delete field representatives in repository', async () => {
      const repo = new FieldRepPgRepository();
      const rep = FieldRep.create({
        id: 'rep-99',
        tenantId,
        userId,
        employeeCode: 'EMP999',
        firstName: 'Bob',
        lastName: 'Smith',
        email: 'bob@dms.com',
        phone: '9876543210',
      });

      await repo.save(rep, tenantId);

      const found = await repo.findById('rep-99', tenantId);
      assert.ok(found);
      assert.strictEqual(found.id, 'rep-99');
      assert.strictEqual(found.employeeCode, 'EMP999');

      const foundByCode = await repo.findByEmployeeCode('EMP999', tenantId);
      assert.ok(foundByCode);
      assert.strictEqual(foundByCode.id, 'rep-99');

      const foundByUserId = await repo.findByUserId(userId, tenantId);
      assert.ok(foundByUserId);
      assert.strictEqual(foundByUserId.id, 'rep-99');

      await repo.delete('rep-99', tenantId);
      const deleted = await repo.findById('rep-99', tenantId);
      assert.strictEqual(deleted, null);
    });
  });

  describe('3. CRUD Use Cases execution', () => {
    test('Should execute Create, Get, Update, and List Use Cases with RBAC', async () => {
      const repo = new FieldRepPgRepository();
      const createUseCase = new CreateFieldRepUseCase(undefined, repo);
      const getUseCase = new GetFieldRepUseCase(undefined, repo);
      const updateUseCase = new UpdateFieldRepUseCase(undefined, repo);
      const listUseCase = new ListFieldRepsUseCase(undefined, repo);

      // Create (Admin)
      const rep = await createUseCase.execute(adminPrincipal, {
        id: 'rep-usecase',
        tenantId,
        userId,
        employeeCode: 'EMP_USECASE',
        firstName: 'Alice',
        lastName: 'Wonder',
        email: 'alice@dms.com',
        phone: '5551234',
      });

      assert.strictEqual(rep.id, 'rep-usecase');
      assert.strictEqual(rep.firstName, 'Alice');

      // Create Agent Role Denied (agents can't create field reps)
      await assert.rejects(async () => {
        await createUseCase.execute(agentPrincipal, {
          id: 'rep-agent-failed',
          tenantId,
          userId: otherUserId,
          employeeCode: 'EMP_FAIL',
          firstName: 'Failed',
          lastName: 'Agent',
          email: 'failed@dms.com',
          phone: '1111111',
        });
      }, /Forbidden: Insufficient permissions to create field representative/);

      // Get (Agent)
      const fetched = await getUseCase.execute(agentPrincipal, 'rep-usecase', tenantId);
      assert.strictEqual(fetched.id, 'rep-usecase');

      // Update info (Admin)
      const updated = await updateUseCase.execute(adminPrincipal, {
        id: 'rep-usecase',
        tenantId,
        firstName: 'Alicia',
        version: 1,
      });
      assert.strictEqual(updated.firstName, 'Alicia');

      // Update Conflict Version Check
      await assert.rejects(async () => {
        await updateUseCase.execute(adminPrincipal, {
          id: 'rep-usecase',
          tenantId,
          firstName: 'Stale',
          version: 1, // Stale version (should be 2 after previous update)
        });
      }, /Optimistic locking conflict/);

      // List field representatives (Agent)
      const list = await listUseCase.execute(agentPrincipal, {
        tenantId,
      });
      assert.strictEqual(list.items.length, 1);
    });

    test('Should audit modifications properly', async () => {
      const repo = new FieldRepPgRepository();
      const createUseCase = new CreateFieldRepUseCase(undefined, repo);

      await createUseCase.execute(adminPrincipal, {
        id: 'rep-audit',
        tenantId,
        userId: otherUserId,
        employeeCode: 'EMP_AUDIT',
        firstName: 'Audited',
        lastName: 'User',
        email: 'audited@dms.com',
        phone: '9999999',
      });

      const auditRepo = AuditController.getInstance().getRepository();
      const logs = await auditRepo.getAllBlocks();
      assert.ok(logs.length > 0);
      const hasCreated = logs.some((l: any) => l.data && l.data.type === 'field_rep.created');
      assert.ok(hasCreated);
    });
  });
});
