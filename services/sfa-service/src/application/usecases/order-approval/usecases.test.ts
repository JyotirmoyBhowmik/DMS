import { test, describe } from 'node:test';
import assert from 'node:assert';
import { CreateOrderApprovalUseCase } from './create_order_approval.usecase.js';
import { UpdateOrderApprovalUseCase } from './update_order_approval.usecase.js';
import { ListOrderApprovalsUseCase } from './list_order_approvals.usecase.js';
import { OrderApprovalPgRepository } from '../../../infrastructure/database/repositories/order-approval.pg-repository.js';

describe('OrderApproval Use Cases Unit Tests', () => {
  const tenantId = '00000000-0000-0000-0000-000000000001';
  const orderId = '00000000-0000-0000-0000-000000000002';
  const agentId = '00000000-0000-0000-0000-000000000003';
  const repo = new OrderApprovalPgRepository();

  test('CreateOrderApprovalUseCase successfully requests approvals', async () => {
    const useCase = new CreateOrderApprovalUseCase(undefined, repo);
    const result = await useCase.execute(tenantId, agentId, {
      id: 'approval-201',
      orderId,
      requestedBy: agentId,
      amount: 15000,
      thresholdAmount: 10000,
    });

    assert.strictEqual(result.approvalId, 'approval-201');
    assert.strictEqual(result.status, 'pending');

    const created = await repo.findById('approval-201', tenantId);
    assert.ok(created);
    assert.strictEqual(created.status, 'pending');
  });

  test('UpdateOrderApprovalUseCase successfully updates status and version check', async () => {
    const createUseCase = new CreateOrderApprovalUseCase(undefined, repo);
    await createUseCase.execute(tenantId, agentId, {
      id: 'approval-202',
      orderId,
      requestedBy: agentId,
      amount: 15000,
      thresholdAmount: 10000,
    });

    const updateUseCase = new UpdateOrderApprovalUseCase(undefined, repo);
    const result = await updateUseCase.execute(tenantId, 'approver-99', 'approval-202', {
      status: 'approved',
      approvedBy: 'approver-99',
      comments: 'Looks fine to me',
    });

    assert.strictEqual(result.status, 'approved');

    const updated = await repo.findById('approval-202', tenantId);
    assert.strictEqual(updated?.status, 'approved');
    assert.strictEqual(updated?.approvedBy, 'approver-99');
    assert.strictEqual(updated?.version, 1);
  });

  test('ListOrderApprovalsUseCase returns paginated results', async () => {
    const listUseCase = new ListOrderApprovalsUseCase(undefined, repo);
    const result = await listUseCase.execute(tenantId, {
      page: 1,
      pageSize: 5,
    });

    assert.ok(result.data.length > 0);
    assert.strictEqual(result.page, 1);
  });
});
