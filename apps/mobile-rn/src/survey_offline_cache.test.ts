import test from 'node:test';
import assert from 'node:assert';
import { SurveyOfflineCache } from './survey_offline_cache.js';
import { TokenSession } from './session_manager.js';

const mockSession: TokenSession = {
  accessToken: 'mock-access-token',
  refreshToken: 'mock-refresh-token',
  expiresAt: Date.now() + 3600000,
  tenantId: '00000000-0000-0000-0000-000000000001',
  email: 'agent@enterprise.com',
  clientSecretKeyHex: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef', // 32 bytes hex
};

void test('SurveyOfflineCache encryption roundtrip', () => {
  const cache = new SurveyOfflineCache(mockSession);
  const survey = {
    id: 'srv-001',
    title: 'Customer Satisfaction Survey',
    answers: { q1: 'Good', q2: 'Very Satisfied' },
    version: 1,
  };

  cache.saveSurveyOffline(survey, 'create');
  
  // Retrieve and decrypt
  const retrieved = cache.getSurveyOffline('srv-001');
  assert.deepStrictEqual(retrieved, survey);
});

void test('SurveyOfflineCache sync queue management', () => {
  const cache = new SurveyOfflineCache(mockSession);
  const s1 = { id: 'srv-1', title: 'Survey 1', version: 1 };
  const s2 = { id: 'srv-2', title: 'Survey 2', version: 1 };

  cache.saveSurveyOffline(s1, 'create');
  cache.saveSurveyOffline(s2, 'create');

  const queue = cache.getSyncQueue();
  assert.strictEqual(queue.length, 2);
  assert.strictEqual(queue[0].surveyId, 'srv-1');
  assert.strictEqual(queue[1].surveyId, 'srv-2');

  // Clear one survey
  cache.clearSurveyOffline('srv-1');
  assert.strictEqual(cache.getSyncQueue().length, 1);
  assert.strictEqual(cache.getSyncQueue()[0].surveyId, 'srv-2');
  assert.strictEqual(cache.getSurveyOffline('srv-1'), null);
});

void test('SurveyOfflineCache sync Survey success and failure handling', async () => {
  const cache = new SurveyOfflineCache(mockSession);
  const s1 = { id: 'srv-1', title: 'Survey 1', version: 1 };
  cache.saveSurveyOffline(s1, 'create');

  // Success sync
  await cache.syncSurvey('srv-1', async (payload) => {
    assert.deepStrictEqual(payload, s1);
    return { success: true };
  });

  assert.strictEqual(cache.getSyncQueue().length, 0);

  // Failure with conflict
  const s2 = { id: 'srv-2', title: 'Survey 2', version: 1 };
  cache.saveSurveyOffline(s2, 'create');

  await assert.rejects(
    async () => {
      await cache.syncSurvey('srv-2', async () => {
        return { success: false, conflict: true };
      });
    },
    (err: any) => err.message === 'CONCURRENCY_CONFLICT'
  );

  assert.strictEqual(cache.getSyncQueue().length, 1);
});

void test('SurveyOfflineCache conflict resolution strategies', () => {
  const cache = new SurveyOfflineCache(mockSession);
  const localSurvey = {
    id: 'srv-1',
    title: 'Local Title',
    answers: { q1: 'Local' },
    version: 1,
  };
  const serverSurvey = {
    id: 'srv-1',
    title: 'Server Title',
    answers: { q1: 'Server', q2: 'ServerOnly' },
    version: 2,
  };

  // Strategy: keep_local
  cache.saveSurveyOffline(localSurvey, 'create');
  cache.resolveConflict('srv-1', 'keep_local', serverSurvey);
  let resolved = cache.getSurveyOffline('srv-1');
  assert.strictEqual(resolved.version, 3); // serverVersion (2) + 1
  assert.strictEqual(resolved.title, 'Local Title');

  // Strategy: keep_server
  cache.saveSurveyOffline(localSurvey, 'create');
  cache.resolveConflict('srv-1', 'keep_server', serverSurvey);
  resolved = cache.getSurveyOffline('srv-1');
  assert.strictEqual(resolved.version, 2);
  assert.strictEqual(resolved.title, 'Server Title');
  // sync queue should be empty for this item since we keep server
  assert.strictEqual(cache.getSyncQueue().length, 0);

  // Strategy: merge
  cache.saveSurveyOffline(localSurvey, 'create');
  cache.resolveConflict('srv-1', 'merge', serverSurvey);
  resolved = cache.getSurveyOffline('srv-1');
  assert.strictEqual(resolved.version, 3); // serverVersion (2) + 1
  assert.deepStrictEqual(resolved.answers, { q1: 'Local', q2: 'ServerOnly' });
});
