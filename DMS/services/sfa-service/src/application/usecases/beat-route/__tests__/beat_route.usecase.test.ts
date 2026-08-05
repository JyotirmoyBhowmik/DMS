import { test, describe } from 'node:test';
import assert from 'node:assert';
import { CreateBeatRouteUseCase } from '../create_beat_route.usecase.js';
import { GetBeatRouteUseCase } from '../get_beat_route.usecase.js';
import { UpdateBeatRouteUseCase } from '../update_beat_route.usecase.js';
import { ListBeatRoutesUseCase } from '../list_beat_routes.usecase.js';
import { BeatRoutePgRepository } from '../../../../infrastructure/database/repositories/beat-route.pg-repository.js';

describe('BeatRoute Use Cases Tests', () => {
  const tenantId = 'tenant-uuid-1111';
  const repo = new BeatRoutePgRepository();

  test('CreateBeatRouteUseCase should create a beat route successfully', async () => {
    const useCase = new CreateBeatRouteUseCase(undefined, repo);
    const result = await useCase.execute(tenantId, {
      id: 'br-usecase-101',
      name: 'Delhi North Beat',
      region: 'Delhi',
      frequency: 'daily',
      outlets: [
        {
          outletId: 'outlet-br-1',
          sequence: 1,
          lat: 28.5,
          lng: 77.2,
        }
      ]
    });

    assert.strictEqual(result.beatRouteId, 'br-usecase-101');
    assert.strictEqual(result.status, 'draft');

    const created = await repo.findById('br-usecase-101', tenantId);
    assert.ok(created);
    assert.strictEqual(created.name, 'Delhi North Beat');
  });

  test('CreateBeatRouteUseCase should reject duplicate names in same region', async () => {
    const useCase = new CreateBeatRouteUseCase(undefined, repo);
    await assert.rejects(async () => {
      await useCase.execute(tenantId, {
        id: 'br-usecase-102',
        name: 'Delhi North Beat', // Same name as previous test
        region: 'Delhi',
      });
    });
  });

  test('UpdateBeatRouteUseCase should execute transitions and updates', async () => {
    const updateUseCase = new UpdateBeatRouteUseCase(undefined, repo);
    const result = await updateUseCase.execute(tenantId, 'br-usecase-101', {
      action: 'activate',
    });

    assert.strictEqual(result.status, 'active');

    const updated = await repo.findById('br-usecase-101', tenantId);
    assert.strictEqual(updated?.status, 'active');
  });

  test('ListBeatRoutesUseCase should query filtered results', async () => {
    const listUseCase = new ListBeatRoutesUseCase(undefined, repo);
    const result = await listUseCase.execute(tenantId, {
      region: 'Delhi',
    });

    assert.ok(result.data.length > 0);
    assert.strictEqual(result.data[0]?.id, 'br-usecase-101');
  });

  test('GetBeatRouteUseCase should return route details', async () => {
    const getUseCase = new GetBeatRouteUseCase(undefined, repo);
    const route = await getUseCase.execute(tenantId, 'br-usecase-101');

    assert.ok(route);
    assert.strictEqual(route.id, 'br-usecase-101');
  });
});
