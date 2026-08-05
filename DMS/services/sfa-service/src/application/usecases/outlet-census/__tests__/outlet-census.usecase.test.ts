import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert';
import { CreateOutletCensusUseCase } from '../create_outlet_census.usecase.js';
import { GetOutletCensusUseCase } from '../get_outlet_census.usecase.js';
import { UpdateOutletCensusUseCase } from '../update_outlet_census.usecase.js';
import { ListOutletCensusesUseCase } from '../list_outlet_censuses.usecase.js';
import { OutletCensusPgRepository } from '../../../../infrastructure/database/repositories/outlet-census.pg-repository.js';

describe('OutletCensus Use Cases Integration Tests', () => {
  let repo: OutletCensusPgRepository;
  const tenantId = '00000000-0000-0000-0000-000000000001';
  const agentId = '00000000-0000-0000-0000-000000000002';
  const outletId = '00000000-0000-0000-0000-000000000003';
  const geoCoords = { latitude: 28.6139, longitude: 77.2090 };

  const sampleInput = {
    agentId,
    outletId,
    censusDate: '2026-07-17',
    outletName: 'Sagar Store CP',
    outletType: 'kirana' as const,
    ownerName: 'Sagar Kumar',
    ownerPhone: '9876543210',
    address: 'Shop 5, Connaught Place, New Delhi',
    geoCoords,
    tradeCategory: 'Groceries',
    photoUrls: [],
    annualTurnoverEstimate: 100000,
    competitorPresence: [],
  };

  beforeEach(() => {
    OutletCensusPgRepository.clearStore();
    repo = new OutletCensusPgRepository();
  });

  test('CreateOutletCensusUseCase should create and persist census, preventing duplicates', async () => {
    const createUseCase = new CreateOutletCensusUseCase(undefined, repo);
    const result = await createUseCase.execute(tenantId, sampleInput);

    assert.ok(result.outletCensusId);
    assert.strictEqual(result.status, 'draft');

    // Attempting duplicate creation for same outlet should fail
    await assert.rejects(async () => {
      await createUseCase.execute(tenantId, sampleInput);
    }, /already has a draft or submitted census/);
  });

  test('GetOutletCensusUseCase should check tenant scoping', async () => {
    const createUseCase = new CreateOutletCensusUseCase(undefined, repo);
    const getUseCase = new GetOutletCensusUseCase(undefined, repo);

    const { outletCensusId } = await createUseCase.execute(tenantId, sampleInput);

    const record = await getUseCase.execute(tenantId, outletCensusId);
    assert.strictEqual(record.id, outletCensusId);

    // Mismatched tenant should reject
    await assert.rejects(async () => {
      await getUseCase.execute('mismatched-tenant', outletCensusId);
    }, /not found or unauthorized/);
  });

  test('UpdateOutletCensusUseCase actions and optimistic locking', async () => {
    const createUseCase = new CreateOutletCensusUseCase(undefined, repo);
    const updateUseCase = new UpdateOutletCensusUseCase(undefined, repo);
    const getUseCase = new GetOutletCensusUseCase(undefined, repo);

    const { outletCensusId } = await createUseCase.execute(tenantId, sampleInput);

    // 1. Submit action
    await updateUseCase.execute(tenantId, outletCensusId, {
      action: 'submit',
    });

    const record = await getUseCase.execute(tenantId, outletCensusId);
    assert.strictEqual(record.status, 'submitted');
    assert.strictEqual(record.version, 1);

    // 2. Reject concurrency lock mismatch
    await assert.rejects(async () => {
      await updateUseCase.execute(tenantId, outletCensusId, {
        action: 'verify',
      }, 0); // expected version is 0 but version is now 1
    }, /Conflict: version mismatch/);
  });

  test('ListOutletCensusesUseCase filters and pagination caps', async () => {
    const createUseCase = new CreateOutletCensusUseCase(undefined, repo);
    const listUseCase = new ListOutletCensusesUseCase(undefined, repo);

    await createUseCase.execute(tenantId, sampleInput);

    const result = await listUseCase.execute(tenantId, {
      agentId,
      status: 'draft',
      page: 1,
      pageSize: 50,
    });

    assert.strictEqual(result.data.length, 1);
    assert.strictEqual(result.data[0]?.outletName, 'Sagar Store CP');
  });
});
