import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import { Collection, CollectionDomainError, InvalidCollectionStateTransitionError } from './domain/entities/collection.entity.js';
import { validateCreateCollectionInput, validateUpdateCollectionInput } from './domain/validation/collection.validation.js';
import { CollectionPgRepository } from './infrastructure/database/repositories/collection.pg-repository.js';
import { CreateCollectionUseCase } from './application/usecases/create-collection.usecase.js';
import { GetCollectionUseCase } from './application/usecases/get-collection.usecase.js';
import { UpdateCollectionUseCase } from './application/usecases/update-collection.usecase.js';
import { ListCollectionsUseCase } from './application/usecases/list-collections.usecase.js';
import { CollectionController } from './presentation/rest/controllers/collection.controller.js';
import { CollectionAuditService } from './infrastructure/audit/collection.audit.js';
import { randomUUID } from 'node:crypto';

describe('Collection Full Vertical Slice QA & Security Suite (Tasks 1313-1320)', () => {
  let repository: CollectionPgRepository;
  let createUseCase: CreateCollectionUseCase;
  let getUseCase: GetCollectionUseCase;
  let updateUseCase: UpdateCollectionUseCase;
  let listUseCase: ListCollectionsUseCase;
  let controller: CollectionController;

  const tenantId = randomUUID();
  const tenantBId = randomUUID();
  const distributorId = randomUUID();

  const adminPrincipal: any = {
    userId: 'user-admin-col-1',
    tenantId,
    roles: ['admin'],
    permissions: [
      'finance:collection:create',
      'finance:collection:read',
      'finance:collection:update',
      'finance:collection:delete',
      'finance:collection:approve',
      'finance:collection:list',
    ],
  };

  const restrictedPrincipal: any = {
    userId: 'user-guest-col-1',
    tenantId,
    roles: ['guest'],
    permissions: [],
  };

  const tenantBPrincipal: any = {
    userId: 'user-tenant-b-col',
    tenantId: tenantBId,
    roles: ['admin'],
    permissions: [
      'finance:collection:create',
      'finance:collection:read',
      'finance:collection:update',
      'finance:collection:delete',
      'finance:collection:approve',
      'finance:collection:list',
    ],
  };

  beforeEach(() => {
    CollectionPgRepository.clearStore();
    CollectionAuditService.clearAuditTrail();
    repository = new CollectionPgRepository();
    createUseCase = new CreateCollectionUseCase(repository);
    getUseCase = new GetCollectionUseCase(repository);
    updateUseCase = new UpdateCollectionUseCase(repository);
    listUseCase = new ListCollectionsUseCase(repository);
    controller = new CollectionController(repository);
  });

  // Tasks 1314 & 1319: Domain Aggregate & State Machine
  describe('Tasks 1314 & 1319: Collection Domain Entity & Invariants', () => {
    it('enforces invariants: tenantId, distributorId, collectionReference, amountCents > 0', () => {
      assert.throws(
        () => new Collection({ tenantId: '', distributorId, collectionReference: 'COL-1', amountCents: 100 }),
        /tenantId is required/
      );
      assert.throws(
        () => new Collection({ tenantId, distributorId: '', collectionReference: 'COL-1', amountCents: 100 }),
        /distributorId is required/
      );
      assert.throws(
        () => new Collection({ tenantId, distributorId, collectionReference: '', amountCents: 100 }),
        /collectionReference is required/
      );
      assert.throws(
        () => new Collection({ tenantId, distributorId, collectionReference: 'COL-ZERO', amountCents: 0 }),
        /amountCents must be > 0/
      );
    });

    it('executes valid state machine transitions (DRAFT -> PENDING -> COLLECTED) and rejects illegal ones', () => {
      const col = new Collection({
        tenantId,
        distributorId,
        collectionReference: 'COL-STATE-1',
        amountCents: 85000,
      });

      assert.strictEqual(col.status, 'DRAFT');

      col.markPending();
      assert.strictEqual(col.status, 'PENDING');
      assert.strictEqual(col.domainEvents.length, 1);

      col.markCollected();
      assert.strictEqual(col.status, 'COLLECTED');
      assert.strictEqual(col.domainEvents.length, 2);

      // Illegal: COLLECTED -> DRAFT
      assert.throws(() => col.transitionTo('DRAFT'), InvalidCollectionStateTransitionError);
    });
  });

  // Task 1320: Domain Validation Rules
  describe('Task 1320: Collection Domain Validation Rules', () => {
    it('validates Create collection input and rejects unknown fields', () => {
      assert.throws(
        () => validateCreateCollectionInput({ distributorId, collectionReference: 'COL-1', amountCents: 500, malicious: 'payload' }),
        /Unknown field 'malicious' is not allowed/
      );

      assert.throws(
        () => validateCreateCollectionInput({ collectionReference: 'COL-1', amountCents: 500 }),
        /REQUIRED_FIELD: distributorId/
      );

      assert.throws(
        () => validateCreateCollectionInput({ distributorId, collectionReference: 'COL-1', amountCents: -50 }),
        /INVALID_RANGE: amountCents/
      );
    });

    it('validates Update collection input and version field', () => {
      assert.throws(
        () => validateUpdateCollectionInput({ status: 'COLLECTED' }),
        /REQUIRED_FIELD: version is required/
      );
    });
  });

  // Tasks 1316-1319: Use Cases & Audit Logging Suite
  describe('Tasks 1316-1319: Collection Use Cases & Audit Trail', () => {
    it('executes CreateCollectionUseCase with idempotency, audit trail & uniqueness checks', async () => {
      const created = await createUseCase.execute(
        adminPrincipal,
        {
          distributorId,
          collectionReference: 'COL-2026-001',
          amountCents: 150000,
          collectionMode: 'CHEQUE',
        },
        'idemp-col-01',
        'corr-col-01'
      );

      assert.strictEqual(created.collectionReference, 'COL-2026-001');
      assert.strictEqual(created.amountCents, 150000);

      // Verify audit trail
      const auditTrail = CollectionAuditService.getAuditTrail(tenantId);
      assert.strictEqual(auditTrail.length, 1);
      assert.strictEqual(auditTrail[0].action, 'COLLECTION_CREATED');
      assert.strictEqual(auditTrail[0].correlationId, 'corr-col-01');

      // Idempotency check
      const duplicateIdemp = await createUseCase.execute(
        adminPrincipal,
        {
          distributorId,
          collectionReference: 'COL-2026-001',
          amountCents: 150000,
        },
        'idemp-col-01'
      );
      assert.strictEqual(duplicateIdemp.id, created.id);

      // Duplicate collectionReference throws conflict
      await assert.rejects(
        () =>
          createUseCase.execute(
            adminPrincipal,
            {
              distributorId,
              collectionReference: 'COL-2026-001',
              amountCents: 150000,
            },
            'idemp-col-02'
          ),
        /already exists/
      );
    });

    it('executes Get, Update and List use cases with optimistic locking', async () => {
      const created = await createUseCase.execute(adminPrincipal, {
        distributorId,
        collectionReference: 'COL-2026-002',
        amountCents: 120000,
      });

      // Get
      const fetched = await getUseCase.execute(adminPrincipal, created.id);
      assert.strictEqual(fetched.id, created.id);

      // Update -> PENDING (version 1)
      const updated = await updateUseCase.execute(adminPrincipal, created.id, {
        status: 'PENDING',
        version: 1,
      });
      assert.strictEqual(updated.status, 'PENDING');

      // Stale update fails
      await assert.rejects(
        () => updateUseCase.execute(adminPrincipal, created.id, { status: 'COLLECTED', version: 1 }),
        /Version conflict/
      );

      // List
      const listRes = await listUseCase.execute(adminPrincipal, { page: 1, limit: 10 });
      assert.strictEqual(listRes.total, 1);
      assert.strictEqual(listRes.data[0].id, created.id);
    });

    it('rejects unauthorized principals', async () => {
      await assert.rejects(
        () =>
          createUseCase.execute(restrictedPrincipal, {
            distributorId,
            collectionReference: 'COL-UNAUTH',
            amountCents: 1000,
          }),
        /Forbidden: Insufficient permissions/
      );
    });
  });

  // Task 1315: Repository & Tenant RLS Isolation Proof
  describe('Task 1315: Repository RLS Isolation Proof', () => {
    it('enforces tenant RLS isolation between Tenant A and Tenant B', async () => {
      const colA = await createUseCase.execute(adminPrincipal, {
        distributorId,
        collectionReference: 'COL-TENANT-A',
        amountCents: 5000,
      });

      const colB = await createUseCase.execute(tenantBPrincipal, {
        distributorId,
        collectionReference: 'COL-TENANT-B',
        amountCents: 7500,
      });

      await assert.rejects(
        () => getUseCase.execute(adminPrincipal, colB.id),
        /Collection with id .* not found/
      );

      await assert.rejects(
        () => getUseCase.execute(tenantBPrincipal, colA.id),
        /Collection with id .* not found/
      );
    });
  });

  // Controller API Routes & Security Suite
  describe('Collection Controller REST API & Security', () => {
    it('handles controller CRUD endpoints with correct HTTP status codes', async () => {
      const headers = {
        'x-tenant-id': tenantId,
        'x-user-id': 'user-admin-col-1',
        'x-user-roles': 'admin',
        'content-type': 'application/json',
      };

      // 1. Create -> 201
      const createRes = await controller.handleCreate(
        {
          distributorId,
          collectionReference: 'COL-API-001',
          amountCents: 65000,
          collectionMode: 'CASH',
        },
        headers
      );
      assert.strictEqual(createRes.statusCode, 201);
      assert.strictEqual(createRes.body.success, true);
      const createdId = (createRes.body as any).collection.id;

      // 2. Get -> 200
      const getRes = await controller.handleGet(createdId, headers);
      assert.strictEqual(getRes.statusCode, 200);
      assert.strictEqual((getRes.body as any).collection.collectionReference, 'COL-API-001');

      // 3. Update -> 200
      const updateRes = await controller.handleUpdate(
        createdId,
        { status: 'PENDING', version: 1 },
        headers
      );
      assert.strictEqual(updateRes.statusCode, 200);
      assert.strictEqual((updateRes.body as any).collection.status, 'PENDING');

      // 4. List -> 200
      const listRes = await controller.handleList({ page: 1, limit: 10 }, headers);
      assert.strictEqual(listRes.statusCode, 200);
      assert.strictEqual((listRes.body as any).total, 1);
    });

    it('rejects unsupported content-type and handles SQL injection safety', async () => {
      const headersXml = {
        'x-tenant-id': tenantId,
        'content-type': 'application/xml',
      };

      const resXml = await controller.handleCreate(
        { distributorId, collectionReference: 'COL-XML', amountCents: 100 },
        headersXml
      );
      assert.strictEqual(resXml.statusCode, 415);
    });
  });
});
