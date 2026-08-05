import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert';
import { CreateAttendanceUseCase } from '../create_attendance.usecase.js';
import { GetAttendanceUseCase } from '../get_attendance.usecase.js';
import { UpdateAttendanceUseCase } from '../update_attendance.usecase.js';
import { ListAttendancesUseCase } from '../list_attendances.usecase.js';
import { AttendancePgRepository } from '../../../../infrastructure/database/repositories/attendance.pg-repository.js';

describe('Attendance Use Cases Integration Tests', () => {
  let repo: AttendancePgRepository;

  beforeEach(() => {
    AttendancePgRepository.clearStore();
    repo = new AttendancePgRepository();
  });

  test('CreateAttendanceUseCase should save correctly and prevent duplicate daily records', async () => {
    const createUseCase = new CreateAttendanceUseCase(undefined, repo);
    const tenantId = 'tenant-uuid-1111';
    const agentId = 'agent-uuid-2222';

    const result = await createUseCase.execute(tenantId, {
      agentId,
      date: '2026-06-05',
    });

    assert.ok(result.attendanceId);
    assert.strictEqual(result.status, 'absent');

    // Attempting duplicate check-in record for same agent + date must throw conflict error
    await assert.rejects(async () => {
      await createUseCase.execute(tenantId, {
        agentId,
        date: '2026-06-05',
      });
    }, /already exists/);
  });

  test('GetAttendanceUseCase should retrieve details or throw if not found', async () => {
    const createUseCase = new CreateAttendanceUseCase(undefined, repo);
    const getUseCase = new GetAttendanceUseCase(undefined, repo);
    const tenantId = 'tenant-uuid-1111';
    const agentId = 'agent-uuid-2222';

    const { attendanceId } = await createUseCase.execute(tenantId, {
      agentId,
      date: '2026-06-05',
    });

    const att = await getUseCase.execute(tenantId, attendanceId);
    assert.strictEqual(att.id, attendanceId);
    assert.strictEqual(att.agentId, agentId);

    await assert.rejects(async () => {
      await getUseCase.execute(tenantId, 'non-existent-uuid');
    }, /not found/);
  });

  test('UpdateAttendanceUseCase should transition checking statuses check_in, check_out, and approve', async () => {
    const createUseCase = new CreateAttendanceUseCase(undefined, repo);
    const updateUseCase = new UpdateAttendanceUseCase(undefined, repo);
    const getUseCase = new GetAttendanceUseCase(undefined, repo);
    const tenantId = 'tenant-uuid-1111';
    const agentId = 'agent-uuid-2222';

    const { attendanceId } = await createUseCase.execute(tenantId, {
      agentId,
      date: '2026-06-05',
    });

    // 1. Check in
    const checkInResult = await updateUseCase.execute(tenantId, attendanceId, {
      action: 'check_in',
      location: { latitude: 28.6139, longitude: 77.2090 },
    });
    assert.strictEqual(checkInResult.status, 'checked_in');

    const stateIn = await getUseCase.execute(tenantId, attendanceId);
    assert.ok(stateIn.checkInTime);
    assert.strictEqual(stateIn.checkInLocation?.latitude, 28.6139);

    // 2. Check out
    const checkOutResult = await updateUseCase.execute(tenantId, attendanceId, {
      action: 'check_out',
      location: { latitude: 28.6140, longitude: 77.2091 },
    });
    assert.strictEqual(checkOutResult.status, 'checked_out');

    const stateOut = await getUseCase.execute(tenantId, attendanceId);
    assert.ok(stateOut.checkOutTime);

    // 3. Approve
    const approveResult = await updateUseCase.execute(tenantId, attendanceId, {
      action: 'approve',
    });
    assert.strictEqual(approveResult.status, 'approved');
  });

  test('ListAttendancesUseCase should support paging and filters scoping', async () => {
    const createUseCase = new CreateAttendanceUseCase(undefined, repo);
    const listUseCase = new ListAttendancesUseCase(undefined, repo);
    const tenantId = 'tenant-uuid-1111';

    await createUseCase.execute(tenantId, { agentId: 'agent-1', date: '2026-06-05' });
    await createUseCase.execute(tenantId, { agentId: 'agent-2', date: '2026-06-06' });

    const result = await listUseCase.execute(tenantId, { pageSize: 1 });
    assert.strictEqual(result.data.length, 1);
    assert.strictEqual(result.pageSize, 1);

    const matchAgent = await listUseCase.execute(tenantId, { agentId: 'agent-1' });
    assert.strictEqual(matchAgent.data.length, 1);
    assert.strictEqual(matchAgent.data[0]?.agentId, 'agent-1');
  });
});
