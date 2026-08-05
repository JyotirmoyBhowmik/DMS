import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert';
import { Distributor } from './domain/entities/distributor.js';
import { Money } from './domain/value-objects/money.js';
import { GeoPoint } from './domain/value-objects/geo-point.js';
import { DistributorPgRepository } from './infrastructure/database/repositories/distributor.pg-repository.js';
import { CreateDistributorUseCase } from './application/usecases/distributor/create-distributor.usecase.js';
import { GetDistributorUseCase } from './application/usecases/distributor/get-distributor.usecase.js';
import { UpdateDistributorUseCase } from './application/usecases/distributor/update-distributor.usecase.js';
import { ListDistributorsUseCase } from './application/usecases/distributor/list-distributors.usecase.js';
import { Principal } from '@dms/pkg-rbac';
import { PostgresDatabaseClient, PgDriver } from '@dms/pkg-database';
import { loadConfigSync } from '@dms/pkg-config';
import { BusinessRuleViolationError, DuplicateDistributorError, ConcurrencyConflictError } from './domain/errors/domain-error.js';

const config = loadConfigSync();

describe('DMS Distributor CRUD, Value Objects, & Concurrency Tests', () => {
  const tenantId = '00000000-0000-0000-0000-000000000001';
  const adminPrincipal: Principal = {
    id: 'user-admin',
    tenantId,
    roles: ['admin'],
  };
  const agentPrincipal: Principal = {
    id: 'user-agent',
    tenantId,
    roles: ['agent'], // by default agent role doesn't have create/update/delete permissions (default-deny)
  };

  let db: PostgresDatabaseClient;
  let repo: DistributorPgRepository;

  beforeEach(() => {
    db = new PostgresDatabaseClient(config.db, new PgDriver());
    repo = new DistributorPgRepository(db);
    DistributorPgRepository.clearStore();
  });

  // ── 1. VALUE OBJECTS ──
  test('Value Objects: Money invariants & decimal conversions', () => {
    const m1 = Money.fromCents(15000); // 150.00
    assert.strictEqual(m1.cents, 15000);
    assert.strictEqual(m1.amount, 150.00);

    const m2 = Money.of(20.50);
    assert.strictEqual(m2.cents, 2050);

    const sum = m1.add(m2);
    assert.strictEqual(sum.cents, 17050);

    const diff = m1.subtract(m2);
    assert.strictEqual(diff.cents, 12950);

    assert.throws(() => Money.fromCents(-100), /cannot be negative/);
    assert.throws(() => m2.subtract(m1), /result in negative money/);
  });

  test('Value Objects: GeoPoint invariants & distance calculations', () => {
    const p1 = new GeoPoint(28.6139, 77.2090); // Delhi
    const p2 = new GeoPoint(19.0760, 72.8777); // Mumbai

    assert.ok(p1.latitude === 28.6139);
    assert.ok(p1.longitude === 77.2090);

    const distance = p1.distanceTo(p2);
    assert.ok(distance > 1000 * 1000); // Greater than 1000 km

    assert.throws(() => new GeoPoint(-95, 100), /Invalid latitude/);
    assert.throws(() => new GeoPoint(45, 190), /Invalid longitude/);
  });

  // ── 2. DOMAIN INVARIANTS & AGGREGATE MUTATIONS ──
  test('Domain: Distributor creation invariants & state updates', () => {
    const dist = Distributor.create({
      id: 'd8c1ad30-3162-4b2a-8cfa-555e0c653066',
      tenantId,
      name: 'Metro Traders',
      region: 'North',
      creditLimit: 5000000,
    });

    assert.strictEqual(dist.name, 'Metro Traders');
    assert.strictEqual(dist.creditLimit.cents, 5000000);
    assert.strictEqual(dist.balance.cents, 0);

    dist.charge(1000000); // Utilizes 10,000.00 Rs
    assert.strictEqual(dist.balance.cents, 1000000);

    dist.receivePayment(500000); // Pays back 5,000.00 Rs
    assert.strictEqual(dist.balance.cents, 500000);

    // Charge exceeding limit
    assert.throws(() => dist.charge(4600000), /Credit limit exceeded/);

    // Empty info validation checks
    assert.throws(() => dist.updateInfo({ name: '' }), /cannot be empty/);
    assert.throws(() => dist.updateInfo({ region: '  ' }), /cannot be empty/);
  });

  // ── 3. USE CASE VALIDATIONS & RBAC DEFAULT-DENY ──
  test('Use Cases: Enforce RBAC permissions (default-deny) on Create & Update', async () => {
    const createUseCase = new CreateDistributorUseCase(undefined, repo);
    const updateUseCase = new UpdateDistributorUseCase(undefined, repo);

    const distId = 'd8c1ad30-3162-4b2a-8cfa-555e0c653067';

    // Agent trying to create should throw BusinessRuleViolationError
    await assert.rejects(
      () => createUseCase.execute(agentPrincipal, {
        id: distId,
        tenantId,
        name: 'Agent Store',
        region: 'East',
        creditLimit: 1000000,
      }),
      /Insufficient permissions/
    );

    // Admin should succeed
    const dist = await createUseCase.execute(adminPrincipal, {
      id: distId,
      tenantId,
      name: 'Admin Store',
      region: 'East',
      creditLimit: 1000000,
    });
    assert.strictEqual(dist.name, 'Admin Store');

    // Agent trying to update should throw
    await assert.rejects(
      () => updateUseCase.execute(agentPrincipal, {
        id: distId,
        tenantId,
        name: 'New Agent Store Name',
        version: dist.version,
      }),
      /Insufficient permissions/
    );
  });

  // ── 4. OPTIMISTIC CONCURRENCY LOCKING ──
  test('Concurrency: Reject updates with stale version keys', async () => {
    const createUseCase = new CreateDistributorUseCase(undefined, repo);
    const updateUseCase = new UpdateDistributorUseCase(undefined, repo);

    const distId = 'd8c1ad30-3162-4b2a-8cfa-555e0c653068';

    const dist = await createUseCase.execute(adminPrincipal, {
      id: distId,
      tenantId,
      name: 'Initial Store',
      region: 'South',
      creditLimit: 2000000,
    });

    assert.strictEqual(dist.version, 1);

    // First update succeeds
    const updated1 = await updateUseCase.execute(adminPrincipal, {
      id: distId,
      tenantId,
      name: 'Updated Store Name 1',
      version: dist.version,
    });
    assert.strictEqual(updated1.version, 2);

    // Second update with stale version key (version = 1 instead of 2) should fail with ConcurrencyConflictError
    await assert.rejects(
      () => updateUseCase.execute(adminPrincipal, {
        id: distId,
        tenantId,
        name: 'Updated Store Name 2',
        version: dist.version, // version = 1 (stale!)
      }),
      ConcurrencyConflictError
    );
  });

  // ── 5. REGIONAL FILTERS & PAGINATION ──
  test('Use Cases: Regional listing, validation schemas & pagination limits', async () => {
    const createUseCase = new CreateDistributorUseCase(undefined, repo);
    const listUseCase = new ListDistributorsUseCase(repo);

    await createUseCase.execute(adminPrincipal, {
      id: 'd8c1ad30-3162-4b2a-8cfa-555e0c653070',
      tenantId,
      name: 'North Store A',
      region: 'North',
      creditLimit: 500000,
    });

    await createUseCase.execute(adminPrincipal, {
      id: 'd8c1ad30-3162-4b2a-8cfa-555e0c653071',
      tenantId,
      name: 'North Store B',
      region: 'North',
      creditLimit: 500000,
    });

    await createUseCase.execute(adminPrincipal, {
      id: 'd8c1ad30-3162-4b2a-8cfa-555e0c653072',
      tenantId,
      name: 'South Store',
      region: 'South',
      creditLimit: 500000,
    });

    // List all
    const all = await listUseCase.execute(adminPrincipal, { tenantId });
    assert.strictEqual(all.totalCount, 3);

    // List by Region North
    const northResult = await listUseCase.execute(adminPrincipal, { tenantId, region: 'North' });
    assert.strictEqual(northResult.totalCount, 2);
    assert.ok(northResult.data.every(d => d.region === 'North'));

    // Pagination validation (limit page size)
    const paginated = await listUseCase.execute(adminPrincipal, { tenantId, page: '1', pageSize: '1' });
    assert.strictEqual(paginated.data.length, 1);
    assert.strictEqual(paginated.pageSize, 1);
    assert.strictEqual(paginated.totalPages, 3);
  });
});
