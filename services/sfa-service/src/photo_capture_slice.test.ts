import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert';
import { PhotoCapture } from './domain/entities/photo-capture.js';
import { PhotoCapturePgRepository } from './infrastructure/database/repositories/photo-capture.pg-repository.js';
import { CreatePhotoCaptureUseCase } from './application/usecases/photo-capture/create-photo-capture.usecase.js';
import { GetPhotoCaptureUseCase } from './application/usecases/photo-capture/get-photo-capture.usecase.js';
import { UpdatePhotoCaptureUseCase } from './application/usecases/photo-capture/update-photo-capture.usecase.js';
import { ListPhotoCapturesUseCase } from './application/usecases/photo-capture/list-photo-captures.usecase.js';
import { Principal } from '@dms/pkg-rbac';
import { AuditController } from '../../audit-service/src/presentation/rest/controllers/audit.controller.js';

describe('SFA PhotoCapture Slice Tests', () => {
  const tenantId = '00000000-0000-0000-0000-000000000001';
  const otherTenantId = '00000000-0000-0000-0000-000000000002';
  const validProps = {
    id: '00000000-0000-0000-0000-000000000099',
    tenantId,
    agentId: '00000000-0000-0000-0000-000000000100',
    outletId: '00000000-0000-0000-0000-000000000200',
    captureDate: '2026-07-19',
    photoUrl: 'https://photos.com/compliance.jpg',
    tags: ['planogram', 'nestle'],
    notes: 'Primary shelf placement Nestum',
  };

  const agentPrincipal: Principal = {
    id: 'agent-123',
    tenantId,
    roles: ['agent'],
  };

  const adminPrincipal: Principal = {
    id: 'admin-456',
    tenantId,
    roles: ['admin'],
  };

  const otherTenantPrincipal: Principal = {
    id: 'agent-789',
    tenantId: otherTenantId,
    roles: ['agent'],
  };

  beforeEach(() => {
    PhotoCapturePgRepository.clearStore();
    AuditController.getInstance().getRepository().clear();
  });

  describe('1. Domain Entity aggregate', () => {
    test('Should create and reconstitute PhotoCapture and validate invariants', () => {
      const capture = PhotoCapture.create(validProps);
      assert.strictEqual(capture.id, validProps.id);
      assert.strictEqual(capture.photoUrl, validProps.photoUrl);
      assert.strictEqual(capture.status, 'DRAFT');
      assert.deepStrictEqual(capture.tags, ['planogram', 'nestle']);
      assert.strictEqual(capture.notes, validProps.notes);
    });

    test('should reject invalid values', () => {
      assert.throws(() => {
        PhotoCapture.create({ ...validProps, id: '' });
      }, /ID cannot be empty/);

      assert.throws(() => {
        PhotoCapture.create({ ...validProps, photoUrl: 'not_a_valid_url' });
      }, /photoUrl must be a valid URL/);
    });

    test('should enforce DRAFT modification only', () => {
      const capture = PhotoCapture.create(validProps);
      capture.updatePhotoUrl('https://photos.com/new-image.jpg');
      assert.strictEqual(capture.photoUrl, 'https://photos.com/new-image.jpg');

      capture.submit();
      assert.strictEqual(capture.status, 'SUBMITTED');

      assert.throws(() => {
        capture.updatePhotoUrl('https://photos.com/hack.jpg');
      }, /Can only mutate photo capture in DRAFT status/);
    });

    test('should handle valid and invalid state transitions', () => {
      const capture = PhotoCapture.create(validProps);
      
      // Invalid transition before submit
      assert.throws(() => {
        capture.approve();
      }, /Cannot transition photo capture from 'DRAFT' to 'APPROVED'/);

      capture.submit();

      // Rejecting requires reason
      assert.throws(() => {
        capture.reject('');
      }, /Rejection reason is required/);

      capture.reject('Poor lighting');
      assert.strictEqual(capture.status, 'REJECTED');
      assert.strictEqual(capture.notes, 'Poor lighting');
    });
  });

  describe('2. Postgres Repository implementation (fallback cache)', () => {
    test('Should save, find, and delete photo captures', async () => {
      const repo = new PhotoCapturePgRepository();
      const capture = PhotoCapture.create(validProps);

      await repo.save(capture);

      const found = await repo.findById(capture.id, tenantId);
      assert.ok(found);
      assert.strictEqual(found.id, capture.id);
      assert.strictEqual(found.photoUrl, capture.photoUrl);

      // Other tenant context should return null
      const foundOther = await repo.findById(capture.id, otherTenantId);
      assert.strictEqual(foundOther, null);

      const count = await repo.count(tenantId);
      assert.strictEqual(count, 1);

      await repo.delete(capture.id, tenantId);
      const afterDelete = await repo.findById(capture.id, tenantId);
      assert.strictEqual(afterDelete, null);
    });
  });

  describe('3. CRUD Use Cases execution', () => {
    test('Should execute Create, Get, Update, and List Use Cases with RBAC', async () => {
      const repo = new PhotoCapturePgRepository();
      const createUseCase = new CreatePhotoCaptureUseCase(undefined, repo);
      const getUseCase = new GetPhotoCaptureUseCase(undefined, repo);
      const updateUseCase = new UpdatePhotoCaptureUseCase(undefined, repo);
      const listUseCase = new ListPhotoCapturesUseCase(undefined, repo);

      // 1. Create PhotoCapture
      const created = await createUseCase.execute(agentPrincipal, validProps);
      assert.strictEqual(created.status, 'DRAFT');

      // 2. Fetch Details
      const fetched = await getUseCase.execute(agentPrincipal, created.id, tenantId);
      assert.strictEqual(fetched.photoUrl, validProps.photoUrl);

      // Verify Audit Log is populated
      const auditRepo = AuditController.getInstance().getRepository();
      const logs = await auditRepo.getAllBlocks();
      assert.ok(logs.some((l: any) => l.data.type === 'photo_capture.created'));

      // Cross-tenant get rejection
      await assert.rejects(async () => {
        await getUseCase.execute(otherTenantPrincipal, created.id, tenantId);
      }, /Forbidden: Tenant context mismatch/);

      // 3. List search & pagination
      const listResult = await listUseCase.execute(agentPrincipal, tenantId, {
        page: 1,
        pageSize: 5,
        status: 'DRAFT',
      });
      assert.strictEqual(listResult.items.length, 1);
      assert.strictEqual(listResult.total, 1);

      // 4. Update and Submit (Agent)
      const updated = await updateUseCase.execute(agentPrincipal, {
        id: created.id,
        tenantId,
        photoUrl: 'https://photos.com/updated.jpg',
        status: 'SUBMITTED',
        version: 0,
      });
      assert.strictEqual(updated.status, 'SUBMITTED');
      assert.strictEqual(updated.photoUrl, 'https://photos.com/updated.jpg');

      // Rejecting submit because version has been incremented (optimistic lock mismatch)
      await assert.rejects(async () => {
        await updateUseCase.execute(agentPrincipal, {
          id: created.id,
          tenantId,
          photoUrl: 'https://photos.com/hack.jpg',
          version: 0, // stale version (should be 1)
        });
      }, /Optimistic locking conflict/);

      // 5. Approve by Admin
      const approved = await updateUseCase.execute(adminPrincipal, {
        id: created.id,
        tenantId,
        status: 'APPROVED',
        version: 1,
      });
      assert.strictEqual(approved.status, 'APPROVED');

      // Rejecting approve attempt by non-admin agent (RBAC guard)
      await assert.rejects(async () => {
        // Reset state back to SUBMITTED to test rejection
        const captureRef = await repo.findById(created.id, tenantId);
        if (captureRef) {
          (captureRef as any).props.status = 'SUBMITTED';
          await repo.save(captureRef);
        }

        await updateUseCase.execute(agentPrincipal, {
          id: created.id,
          tenantId,
          status: 'APPROVED',
          version: 2,
        });
      }, /Only admin can approve or reject/);
    });
  });
});
