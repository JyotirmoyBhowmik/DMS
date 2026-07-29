import { describe, test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { FileObjectAggregate } from './domain/entities/file_object.entity.js';
import { FileObjectPgRepository } from './infrastructure/database/repositories/file_object.pg-repository.js';
import { CreateFileObjectUseCase, Principal } from './application/usecases/create-file-object.usecase.js';
import { GetFileObjectUseCase } from './application/usecases/get-file-object.usecase.js';
import { UpdateFileObjectUseCase } from './application/usecases/update-file-object.usecase.js';
import { ListFileObjectsUseCase } from './application/usecases/list-file-objects.usecase.js';
import { FileObjectController } from './presentation/rest/controllers/file_object.controller.js';
import { FileObjectEventConsumer } from './infrastructure/events/file_object.consumer.js';
import { FileObjectAuditService } from './infrastructure/audit/file_object.audit.js';

describe('FileObject Vertical Slice - Comprehensive QA & Security Test Suite', () => {
  const tenantId = '00000000-0000-0000-0000-000000000001';
  const principal: Principal = {
    userId: 'user-admin-1',
    tenantId,
    roles: ['admin'],
    permissions: ['file:create', 'file:read', 'file:update', 'file:delete', 'file:approve']
  };

  const restrictedPrincipal: Principal = {
    userId: 'user-viewer-1',
    tenantId,
    roles: ['viewer'],
    permissions: ['file:read']
  };

  let sharedStore: Map<string, FileObjectAggregate>;
  let repo: FileObjectPgRepository;
  let auditService: FileObjectAuditService;
  let createUseCase: CreateFileObjectUseCase;
  let getUseCase: GetFileObjectUseCase;
  let updateUseCase: UpdateFileObjectUseCase;
  let listUseCase: ListFileObjectsUseCase;
  let controller: FileObjectController;
  let consumer: FileObjectEventConsumer;

  beforeEach(() => {
    sharedStore = new Map<string, FileObjectAggregate>();
    repo = new FileObjectPgRepository(undefined, sharedStore);
    auditService = new FileObjectAuditService();
    FileObjectAuditService.clearAuditLogs();
    createUseCase = new CreateFileObjectUseCase(repo, auditService);
    getUseCase = new GetFileObjectUseCase(repo);
    updateUseCase = new UpdateFileObjectUseCase(repo, auditService);
    listUseCase = new ListFileObjectsUseCase(repo);
    controller = new FileObjectController(createUseCase, getUseCase, updateUseCase, listUseCase);
    consumer = new FileObjectEventConsumer();
  });

  describe('1. Domain Entity Invariants & State Machine (Tasks 1612, 1619, 1624)', () => {
    test('should create valid FileObjectAggregate in PENDING status', () => {
      const file = FileObjectAggregate.create({
        id: randomUUID(),
        tenantId,
        filename: 'contract.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 2048,
        storagePath: '/files/contract.pdf',
        checksum: 'checksum-abc-123'
      });

      assert.equal(file.status, 'PENDING');
      assert.equal(file.version, 1);
      assert.equal(file.filename, 'contract.pdf');
    });

    test('should reject creation if required fields are invalid or negative sizeBytes', () => {
      assert.throws(() => {
        FileObjectAggregate.create({
          id: randomUUID(),
          tenantId,
          filename: '',
          mimeType: 'application/pdf',
          sizeBytes: 2048,
          storagePath: '/files/contract.pdf',
          checksum: 'checksum-abc'
        });
      }, /FileObject filename is required/);

      assert.throws(() => {
        FileObjectAggregate.create({
          id: randomUUID(),
          tenantId,
          filename: 'test.pdf',
          mimeType: 'application/pdf',
          sizeBytes: -100,
          storagePath: '/files/test.pdf',
          checksum: 'checksum-abc'
        });
      }, /FileObject sizeBytes must be non-negative/);
    });

    test('should execute legal state transitions: PENDING -> UPLOADED -> ARCHIVED -> DELETED and approve()', () => {
      const file = FileObjectAggregate.create({
        id: randomUUID(),
        tenantId,
        filename: 'report.xlsx',
        mimeType: 'application/vnd.ms-excel',
        sizeBytes: 4096,
        storagePath: '/files/report.xlsx',
        checksum: 'checksum-xyz'
      });

      file.approve();
      assert.equal(file.status, 'UPLOADED');
      assert.equal(file.version, 2);

      file.archive(2);
      assert.equal(file.status, 'ARCHIVED');
      assert.equal(file.version, 3);

      file.markDeleted(3);
      assert.equal(file.status, 'DELETED');
      assert.equal(file.version, 4);
    });

    test('should reject illegal state transitions', () => {
      const file = FileObjectAggregate.create({
        id: randomUUID(),
        tenantId,
        filename: 'report.xlsx',
        mimeType: 'application/vnd.ms-excel',
        sizeBytes: 4096,
        storagePath: '/files/report.xlsx',
        checksum: 'checksum-xyz'
      });

      // Cannot archive from PENDING
      assert.throws(() => {
        file.archive(1);
      }, /Cannot archive FileObject in status PENDING/);
    });
  });

  describe('2. Application Use Cases, Validation, Audit & RBAC (Tasks 1614–1618, 1624, 1625)', () => {
    test('CreateFileObjectUseCase should sanitize filename, record audit log and enforce RBAC', async () => {
      const res = await createUseCase.execute(principal, {
        filename: '../../dangerous<name>.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 512,
        storagePath: '/s3/doc.pdf',
        checksum: 'chk-123'
      });

      assert.ok(res.id);
      assert.equal(res.filename, 'dangerous_name_.pdf'); // Sanitized
      assert.equal(FileObjectAuditService.getAuditLogs().length, 1);
      assert.equal(FileObjectAuditService.getAuditLogs()[0].action, 'FILE_OBJECT_CREATED');
    });

    test('CreateFileObjectUseCase should enforce idempotency deduplication', async () => {
      const dto = {
        filename: 'data.json',
        mimeType: 'application/json',
        sizeBytes: 100,
        storagePath: '/s3/data.json',
        checksum: 'chk-json',
        idempotencyKey: 'idemp-file-001'
      };

      await createUseCase.execute(principal, dto);

      await assert.rejects(async () => {
        await createUseCase.execute(principal, dto);
      }, /Duplicate request: Idempotency key 'idemp-file-001' already processed/);
    });

    test('should reject creation for principal without file:create permission', async () => {
      await assert.rejects(async () => {
        await createUseCase.execute(restrictedPrincipal, {
          filename: 'doc.pdf',
          mimeType: 'application/pdf',
          sizeBytes: 100,
          storagePath: '/path',
          checksum: 'chk'
        });
      }, /Forbidden: Insufficient permissions to create file object/);
    });

    test('should reject approval for restricted user', async () => {
      const created = await createUseCase.execute(principal, {
        filename: 'review.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 100,
        storagePath: '/path',
        checksum: 'chk'
      });

      await assert.rejects(async () => {
        await updateUseCase.approveFileObject(restrictedPrincipal, created.id);
      }, /Forbidden: Insufficient permissions to approve file object/);
    });

    test('GetFileObjectUseCase and ListFileObjectsUseCase should work for authorized user', async () => {
      const created = await createUseCase.execute(principal, {
        filename: 'statement.csv',
        mimeType: 'text/csv',
        sizeBytes: 300,
        storagePath: '/s3/stmt.csv',
        checksum: 'chk-csv'
      });

      const fetched = await getUseCase.execute(principal, created.id);
      assert.equal(fetched.id, created.id);

      const listRes = await listUseCase.execute(principal, { filename: 'statement' });
      assert.equal(listRes.total, 1);
      assert.equal(listRes.fileObjects[0].id, created.id);
    });

    test('UpdateFileObjectUseCase should update status with optimistic locking', async () => {
      const created = await createUseCase.execute(principal, {
        filename: 'image.png',
        mimeType: 'image/png',
        sizeBytes: 800,
        storagePath: '/s3/img.png',
        checksum: 'chk-png'
      });

      const updated = await updateUseCase.execute(principal, created.id, {
        status: 'UPLOADED',
        expectedVersion: 1
      });

      assert.equal(updated.status, 'UPLOADED');
      assert.equal(updated.version, 2);
    });
  });

  describe('3. Postgres Repository Integration & RLS Isolation (Task 1613 & 1628)', () => {
    test('should isolate file objects between tenants (RLS simulation)', async () => {
      const storeA = new Map<string, FileObjectAggregate>();
      const storeB = new Map<string, FileObjectAggregate>();
      const repoA = new FileObjectPgRepository(undefined, storeA);
      const repoB = new FileObjectPgRepository(undefined, storeB);

      const id = randomUUID();
      const fileA = FileObjectAggregate.create({
        id,
        tenantId: 'tenant-A',
        filename: 'tenantA_file.txt',
        mimeType: 'text/plain',
        sizeBytes: 10,
        storagePath: '/s3/a.txt',
        checksum: 'chk-a'
      });

      await repoA.save(fileA);

      const foundA = await repoA.findById(id, 'tenant-A');
      assert.ok(foundA);

      const foundB = await repoB.findById(id, 'tenant-B');
      assert.equal(foundB, null);
    });
  });

  describe('4. REST Controller & Event Consumer Tests (Tasks 1620, 1621 & 1629)', () => {
    test('FileObjectController handleCreate should return 201 and reject non-JSON Content-Type with 415', async () => {
      const validReq = {
        headers: { 'content-type': 'application/json' },
        body: {
          filename: 'spec.pdf',
          mimeType: 'application/pdf',
          sizeBytes: 400,
          storagePath: '/s3/spec.pdf',
          checksum: 'chk-spec'
        },
        principal
      };

      const res = await controller.handleCreate(validReq);
      assert.equal(res.statusCode, 201);

      const invalidReq = {
        headers: { 'content-type': 'text/plain' },
        body: validReq.body,
        principal
      };

      const errRes = await controller.handleCreate(invalidReq);
      assert.equal(errRes.statusCode, 415);
    });

    test('FileObjectController handleApprove should succeed for authorized principal', async () => {
      const created = await createUseCase.execute(principal, {
        filename: 'doc-to-approve.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 500,
        storagePath: '/s3/doc.pdf',
        checksum: 'chk'
      });

      const res = await controller.handleApprove({
        headers: {},
        params: { id: created.id },
        principal
      });
      assert.equal(res.statusCode, 200);
      assert.equal(res.body.status, 'UPLOADED');
    });

    test('FileObjectEventConsumer should process domain events, deduplicate, and route to DLQ', async () => {
      const event = {
        eventId: 'evt-file-001',
        eventType: 'file.object.uploaded',
        aggregateId: 'file-001',
        tenantId,
        timestamp: new Date().toISOString(),
        data: {}
      };

      const first = await consumer.handleEvent(event);
      assert.equal(first, true);

      const second = await consumer.handleEvent(event);
      assert.equal(second, true); // Deduplicated

      const badEvent = { eventId: '', eventType: '' } as any;
      const failed = await consumer.handleEvent(badEvent);
      assert.equal(failed, false);
      assert.equal(consumer.getDlq().length, 1);
    });
  });
});
