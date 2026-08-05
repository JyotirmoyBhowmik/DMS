import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { ScopeGuard } from './scope_guard.js';
import { buildDefaultScopeClaims } from './personas.js';

describe('ScopeGuard', () => {
  test('allows customer-wide access when distributorIds empty', () => {
    const scope = buildDefaultScopeClaims(['admin']);
    assert.equal(
      ScopeGuard.canAccessResource(scope, {
        tenantId: 't1',
        distributorId: 'd1',
      }),
      true,
    );
  });

  test('denies distributor outside scope', () => {
    const scope = buildDefaultScopeClaims(['distributor'], {
      distributorIds: ['d-allowed'],
    });
    assert.equal(
      ScopeGuard.canAccessResource(scope, {
        tenantId: 't1',
        distributorId: 'd-other',
      }),
      false,
    );
  });

  test('hasModule checks entitlements', () => {
    const scope = buildDefaultScopeClaims(['van_operator']);
    assert.equal(ScopeGuard.hasModule(scope, 'sfa.van_sale'), true);
    assert.equal(ScopeGuard.hasModule(scope, 'dms.full'), false);
  });
});
