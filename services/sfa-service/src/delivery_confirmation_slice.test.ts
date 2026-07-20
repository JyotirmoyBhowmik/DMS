import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert';
import { DeliveryConfirmation, DeliveryStatus } from './domain/entities/delivery-confirmation.js';
import { GeoPoint } from './domain/value-objects/geo-point.js';
import { DeliveryConfirmationPgRepository } from './infrastructure/database/repositories/delivery-confirmation.pg-repository.js';
import { CreateDeliveryConfirmationUseCase } from './application/usecases/delivery-confirmation/create-delivery-confirmation.usecase.js';
import { GetDeliveryConfirmationUseCase } from './application/usecases/delivery-confirmation/get-delivery-confirmation.usecase.js';
import { UpdateDeliveryConfirmationUseCase } from './application/usecases/delivery-confirmation/update-delivery-confirmation.usecase.js';
import { ListDeliveryConfirmationsUseCase } from './application/usecases/delivery-confirmation/list-delivery-confirmations.usecase.js';
import { DeliveryConfirmationController } from './presentation/rest/controllers/delivery-confirmation.controller.js';
import { Principal } from '@dms/pkg-rbac';
import { AuditController } from '../../../services/audit-service/src/presentation/rest/controllers/audit.controller.js';

describe('SFA DeliveryConfirmation Slice Tests', () => {
  const tenantId = '00000000-0000-0000-0000-000000000001';
  const otherTenantId = '00000000-0000-0000-0000-000000000002';
  const orderId = '00000000-0000-0000-0000-000000000111';
  const confirmationId = '00000000-0000-0000-0000-000000000222';

  const agentPrincipal: Principal = {
    id: 'user-agent-123',
    tenantId,
    roles: ['agent'],
  };

  const adminPrincipal: Principal = {
    id: 'user-admin-999',
    tenantId,
    roles: ['admin'],
  };

  const unauthorizedPrincipal: Principal = {
    id: 'user-agent-456',
    tenantId: otherTenantId,
    roles: ['agent'],
  };

  beforeEach(() => {
    DeliveryConfirmationController.clearStore();
  });

  describe('1. Domain Entity aggregate', () => {
    test('Should enforce aggregate constructor invariants', () => {
      // Invariant: receivedBy cannot be empty
      assert.throws(() => {
        DeliveryConfirmation.create({
          id: confirmationId,
          tenantId,
          orderId,
          deliveredAt: new Date(),
          receivedBy: '',
          gpsLocation: GeoPoint.create(10, 20),
          status: 'FULL',
        });
      }, /receivedBy cannot be empty/);

      // Invariant: rejectionReason required for status REJECTED
      assert.throws(() => {
        DeliveryConfirmation.create({
          id: confirmationId,
          tenantId,
          orderId,
          deliveredAt: new Date(),
          receivedBy: 'John Doe',
          gpsLocation: GeoPoint.create(10, 20),
          status: 'REJECTED',
        });
      }, /rejectionReason is required for status REJECTED/);

      // Invariant: coordinates must be within bounds
      assert.throws(() => {
        DeliveryConfirmation.create({
          id: confirmationId,
          tenantId,
          orderId,
          deliveredAt: new Date(),
          receivedBy: 'John Doe',
          gpsLocation: GeoPoint.create(120, 20), // lat > 90
          status: 'FULL',
        });
      }, /between -90 and 90/);
    });

    test('Should transition status state machine correctly', () => {
      const confirmation = DeliveryConfirmation.create({
        id: confirmationId,
        tenantId,
        orderId,
        deliveredAt: new Date(),
        receivedBy: 'John Doe',
        gpsLocation: GeoPoint.create(10, 20),
        status: 'PARTIAL',
      });

      assert.strictEqual(confirmation.status, 'PARTIAL');

      // PARTIAL -> FULL is allowed
      confirmation.confirmFullDelivery('John Doe', 'http://photo.com/1');
      assert.strictEqual(confirmation.status, 'FULL');

      // FULL -> REJECTED is illegal
      assert.throws(() => {
        confirmation.rejectDelivery('Damaged goods', 'John Doe');
      }, /Cannot transition delivery confirmation from 'FULL' to 'REJECTED'/);
    });
  });

  describe('2. Postgres Repository implementation', () => {
    test('Should execute save, find, and delete correctly', async () => {
      const repo = new DeliveryConfirmationPgRepository();
      const confirmation = DeliveryConfirmation.create({
        id: confirmationId,
        tenantId,
        orderId,
        deliveredAt: new Date(),
        receivedBy: 'John Doe',
        gpsLocation: GeoPoint.create(12.34, 56.78),
        status: 'FULL',
      });

      await repo.save(confirmation);

      const found = await repo.findById(confirmationId, tenantId);
      assert.ok(found);
      assert.strictEqual(found.receivedBy, 'John Doe');

      const byOrder = await repo.findByOrder(orderId, tenantId);
      assert.ok(byOrder);
      assert.strictEqual(byOrder.id, confirmationId);

      const byTenant = await repo.findByTenant(tenantId);
      assert.strictEqual(byTenant.length, 1);

      await repo.delete(confirmationId, tenantId);
      const foundAfter = await repo.findById(confirmationId, tenantId);
      assert.strictEqual(foundAfter, null);
    });
  });

  describe('3. CRUD Use Cases execution', () => {
    test('Should create, get, update, and list successfully', async () => {
      const repo = new DeliveryConfirmationPgRepository();
      const createUC = new CreateDeliveryConfirmationUseCase(undefined, repo);
      const getUC = new GetDeliveryConfirmationUseCase(undefined, repo);
      const updateUC = new UpdateDeliveryConfirmationUseCase(undefined, repo);
      const listUC = new ListDeliveryConfirmationsUseCase(undefined, repo);

      const created = await createUC.execute(agentPrincipal, {
        tenantId,
        orderId,
        deliveredAt: new Date().toISOString(),
        receivedBy: 'John Doe',
        gpsLocation: { latitude: 10, longitude: 20 },
        status: 'PARTIAL',
      });

      assert.strictEqual(created.status, 'PARTIAL');

      // Idempotency: creating again return existing confirmation
      const dup = await createUC.execute(agentPrincipal, {
        tenantId,
        orderId,
        deliveredAt: new Date().toISOString(),
        receivedBy: 'John Doe',
        gpsLocation: { latitude: 10, longitude: 20 },
        status: 'PARTIAL',
      });
      assert.strictEqual(dup.id, created.id);

      // Get
      const fetched = await getUC.execute(agentPrincipal, created.id, tenantId);
      assert.strictEqual(fetched.receivedBy, 'John Doe');

      // Update
      const updated = await updateUC.execute(agentPrincipal, created.id, tenantId, {
        status: 'FULL',
        signaturePhotoUrl: 'http://foo.com/photo',
        version: 1,
      });
      assert.strictEqual(updated.status, 'FULL');
      assert.strictEqual(updated.version, 2);

      // List
      const list = await listUC.execute(agentPrincipal, tenantId);
      assert.strictEqual(list.total, 1);

      // Tenant isolation violation check
      await assert.rejects(
        getUC.execute(unauthorizedPrincipal, created.id, tenantId),
        /Tenant context mismatch/
      );
    });
  });

  describe('4. REST Controller routes mapping', () => {
    test('Should invoke controller endpoints successfully', async () => {
      const controller = new DeliveryConfirmationController();
      const auditRepo = AuditController.getInstance().getRepository();
      auditRepo.clear();

      const createRes = await controller.handleCreate({
        orderId,
        deliveredAt: new Date().toISOString(),
        receivedBy: 'John Doe',
        gpsLocation: { latitude: 12.34, longitude: 56.78 },
        status: 'REJECTED',
        rejectionReason: 'Broken seal',
      }, {
        'x-tenant-id': tenantId,
        'x-user-id': 'agent-123',
        'x-user-roles': 'agent',
      });

      assert.strictEqual(createRes.statusCode, 201);
      const conf = createRes.body.confirmation as any;
      assert.strictEqual(conf.status, 'REJECTED');

      // Cryptographic audit log check
      const blocks = await auditRepo.getAllBlocks();
      assert.ok(blocks.length > 0);
      const creationLogBlock = blocks.find((b: any) => b.data && b.data.type === 'delivery_confirmation.created');
      assert.ok(creationLogBlock);
      assert.strictEqual(creationLogBlock.data.actor, 'agent-123');

      // Get
      const getRes = await controller.handleGetDeliveryConfirmation(conf.id, {
        'x-tenant-id': tenantId,
        'x-user-id': 'agent-123',
        'x-user-roles': 'agent',
      });
      assert.strictEqual(getRes.statusCode, 200);

      // Put
      const putRes = await controller.handlePutDeliveryConfirmation(conf.id, {
        status: 'FULL',
        receivedBy: 'Jane Doe',
        version: 1,
      }, {
        'x-tenant-id': tenantId,
        'x-user-id': 'agent-123',
        'x-user-roles': 'agent',
      });
      assert.strictEqual(putRes.statusCode, 200);
      assert.strictEqual((putRes.body.confirmation as any).status, 'FULL');

      // Delete (forbidden for agent)
      const deleteAgentRes = await controller.handleDeleteDeliveryConfirmation(conf.id, {
        'x-tenant-id': tenantId,
        'x-user-id': 'agent-123',
        'x-user-roles': 'agent',
      });
      assert.strictEqual(deleteAgentRes.statusCode, 403);

      // Delete (allowed for admin)
      const deleteAdminRes = await controller.handleDeleteDeliveryConfirmation(conf.id, {
        'x-tenant-id': tenantId,
        'x-user-id': 'admin-999',
        'x-user-roles': 'admin',
      });
      assert.strictEqual(deleteAdminRes.statusCode, 200);
    });
  });
});
