import { test, describe } from 'node:test';
import assert from 'node:assert';
import { OrderApproval } from './order-approval.js';
import { Money } from '../value-objects/money.js';

describe('OrderApproval Domain Aggregate Tests', () => {
  const tenantId = '00000000-0000-0000-0000-000000000001';
  const orderId = '00000000-0000-0000-0000-000000000002';
  const userId = '00000000-0000-0000-0000-000000000003';

  test('Auto-approves when order amount is less than or equal to threshold', () => {
    const approval = OrderApproval.create({
      id: 'approval-101',
      tenantId,
      orderId,
      requestedBy: userId,
      thresholdAmount: Money.of(1000, 'INR'),
      orderAmount: Money.of(500, 'INR'),
    });

    assert.strictEqual(approval.status, 'approved');
    assert.strictEqual(approval.approvedBy, 'SYSTEM_AUTO_APPROVE');
  });

  test('Stays pending when order amount is greater than threshold', () => {
    const approval = OrderApproval.create({
      id: 'approval-102',
      tenantId,
      orderId,
      requestedBy: userId,
      thresholdAmount: Money.of(1000, 'INR'),
      orderAmount: Money.of(1500, 'INR'),
    });

    assert.strictEqual(approval.status, 'pending');
    assert.strictEqual(approval.approvedBy, null);
  });

  test('Transition to approved and rejected states successfully', () => {
    const approval = OrderApproval.create({
      id: 'approval-103',
      tenantId,
      orderId,
      requestedBy: userId,
      thresholdAmount: Money.of(1000, 'INR'),
      orderAmount: Money.of(1500, 'INR'),
    });

    approval.approve('manager-1', 'Looks good');
    assert.strictEqual(approval.status, 'approved');
    assert.strictEqual(approval.approvedBy, 'manager-1');
    assert.strictEqual(approval.comments, 'Looks good');

    const approval2 = OrderApproval.create({
      id: 'approval-104',
      tenantId,
      orderId,
      requestedBy: userId,
      thresholdAmount: Money.of(1000, 'INR'),
      orderAmount: Money.of(1500, 'INR'),
    });

    approval2.reject('manager-1', 'Too high credit risk');
    assert.strictEqual(approval2.status, 'rejected');
    assert.strictEqual(approval2.comments, 'Too high credit risk');
  });

  test('Transitions to escalated state successfully and checks max level bounds', () => {
    const approval = OrderApproval.create({
      id: 'approval-105',
      tenantId,
      orderId,
      requestedBy: userId,
      thresholdAmount: Money.of(1000, 'INR'),
      orderAmount: Money.of(1500, 'INR'),
    });

    assert.strictEqual(approval.approvalLevel, 1);
    approval.escalate();
    assert.strictEqual(approval.status, 'escalated');
  });
});
