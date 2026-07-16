import { test, describe } from 'node:test';
import assert from 'node:assert';
import { Attendance } from '../attendance.js';
import { GeoPoint } from '../../value-objects/geo-point.js';

describe('Attendance Domain Entity Invariants', () => {
  test('Should initialize correctly in absent status', () => {
    const att = Attendance.create({
      id: 'att-1',
      tenantId: 'tenant-1',
      agentId: 'agent-1',
      date: '2026-06-05',
    });

    assert.strictEqual(att.id, 'att-1');
    assert.strictEqual(att.status, 'absent');
    assert.strictEqual(att.checkInTime, null);
    assert.strictEqual(att.checkOutTime, null);
  });

  test('Should handle correct checkIn state transitions', () => {
    const att = Attendance.create({
      id: 'att-1',
      tenantId: 'tenant-1',
      agentId: 'agent-1',
      date: '2026-06-05',
    });

    const point = GeoPoint.create(28.6139, 77.2090);
    att.checkIn(point);

    assert.strictEqual(att.status, 'checked_in');
    assert.ok(att.checkInTime instanceof Date);
    assert.strictEqual(att.checkInLocation?.latitude, 28.6139);
  });

  test('Should reject checkIn from invalid states', () => {
    const att = Attendance.create({
      id: 'att-1',
      tenantId: 'tenant-1',
      agentId: 'agent-1',
      date: '2026-06-05',
    });

    att.checkIn(GeoPoint.create(28, 77));

    assert.throws(() => {
      att.checkIn(GeoPoint.create(28, 77));
    }, /Cannot check in/);
  });

  test('Should compute total hours and overtime after checkout', () => {
    const att = Attendance.create({
      id: 'att-1',
      tenantId: 'tenant-1',
      agentId: 'agent-1',
      date: '2026-06-05',
    });

    att.checkIn(GeoPoint.create(28, 77));

    // Manipulate checkin time to simulate hours worked
    const checkIn = new Date();
    checkIn.setHours(checkIn.getHours() - 10); // 10 hours ago
    (att as any).props.checkInTime = checkIn;

    att.checkOut(GeoPoint.create(28.1, 77.1));

    assert.strictEqual(att.status, 'checked_out');
    assert.ok(att.totalHoursWorked >= 9.9 && att.totalHoursWorked <= 10.1);
    assert.ok(att.overtimeHours >= 1.9 && att.overtimeHours <= 2.1);
  });

  test('Should handle leave type registration', () => {
    const att = Attendance.create({
      id: 'att-1',
      tenantId: 'tenant-1',
      agentId: 'agent-1',
      date: '2026-06-05',
    });

    att.setLeaveType('Casual');
    assert.strictEqual(att.leaveType, 'Casual');
  });

  test('Should handle approve transition only from checked_out state', () => {
    const att = Attendance.create({
      id: 'att-1',
      tenantId: 'tenant-1',
      agentId: 'agent-1',
      date: '2026-06-05',
    });

    assert.throws(() => {
      att.approve();
    }, /Cannot approve/);

    att.checkIn(GeoPoint.create(28, 77));
    assert.throws(() => {
      att.approve();
    }, /Cannot approve/);

    att.checkOut(GeoPoint.create(28, 77));
    att.approve();
    assert.strictEqual(att.status, 'approved');
  });
});
