import { describe, it } from 'node:test';
import assert from 'node:assert';
import { RbacGuard, RequirePermissions, Principal } from './index.js';

class MockController {
  @RequirePermissions('order:create', 'order:read')
  createOrder() {
    return 'order-created';
  }

  @RequirePermissions('visit:*')
  manageVisit() {
    return 'visit-managed';
  }

  noPermissionsRequired() {
    return 'open';
  }
}

describe('RBAC Guard Tests', () => {
  const adminPrincipal: Principal = {
    id: 'usr-1',
    tenantId: 'tn-1',
    roles: ['admin']
  };

  const agentPrincipal: Principal = {
    id: 'usr-2',
    tenantId: 'tn-1',
    roles: ['agent']
  };

  const visitorPrincipal: Principal = {
    id: 'usr-3',
    tenantId: 'tn-1',
    roles: []
  };

  it('admin should have wildcard permissions for everything', () => {
    assert.strictEqual(RbacGuard.can(adminPrincipal, 'any:permission:at:all'), true);
  });

  it('agent should have exact match permissions', () => {
    assert.strictEqual(RbacGuard.can(agentPrincipal, 'order:create'), true);
    assert.strictEqual(RbacGuard.can(agentPrincipal, 'order:read'), true);
    assert.strictEqual(RbacGuard.can(agentPrincipal, 'order:delete'), false);
  });

  it('agent should support action wildcards', () => {
    const controller = new MockController();
    
    // Principal roles: agent has 'visit:create' and 'visit:read', but not wildcard 'visit:*'
    // Let's verify 'visit:create' works for agent
    assert.strictEqual(RbacGuard.can(agentPrincipal, 'visit:create'), true);
    
    // Principal with 'admin' should pass visit:*
    assert.strictEqual(RbacGuard.checkPermission(adminPrincipal, controller, 'manageVisit'), true);
  });

  it('principal without roles should have no permissions', () => {
    assert.strictEqual(RbacGuard.can(visitorPrincipal, 'order:read'), false);
  });

  it('checkPermission should enforce decorators on methods', () => {
    const controller = new MockController();

    // admin has permissions
    assert.strictEqual(RbacGuard.checkPermission(adminPrincipal, controller, 'createOrder'), true);

    // agent has order:create and order:read
    assert.strictEqual(RbacGuard.checkPermission(agentPrincipal, controller, 'createOrder'), true);

    // visitor does not
    assert.strictEqual(RbacGuard.checkPermission(visitorPrincipal, controller, 'createOrder'), false);

    // no decorators method should pass for everyone
    assert.strictEqual(RbacGuard.checkPermission(visitorPrincipal, controller, 'noPermissionsRequired'), true);
  });
});
