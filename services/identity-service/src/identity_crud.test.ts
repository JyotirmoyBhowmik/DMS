import { test, describe } from 'node:test';
import assert from 'node:assert';
import { PostgresDatabaseClient, InMemoryDriver } from '@dms/pkg-database';
import { UserPgRepository } from './infrastructure/database/repositories/user.pg-repository.js';
import { RolePgRepository } from './infrastructure/database/repositories/role.pg-repository.js';
import { TenantPgRepository } from './infrastructure/database/repositories/tenant.pg-repository.js';
import { PermissionPgRepository } from './infrastructure/database/repositories/permission.pg-repository.js';
import { MFADevicePgRepository } from './infrastructure/database/repositories/mfa_device.pg-repository.js';

import {
  CreateUserUseCase,
  GetUserUseCase,
  UpdateUserUseCase,
  DeleteUserUseCase,
  ListUsersUseCase
} from './application/usecases/user.usecases.js';

import {
  CreateRoleUseCase,
  GetRoleUseCase,
  UpdateRoleUseCase,
  DeleteRoleUseCase,
  ListRolesUseCase
} from './application/usecases/role.usecases.js';

import {
  CreateTenantUseCase,
  GetTenantUseCase,
  UpdateTenantUseCase,
  DeleteTenantUseCase,
  ListTenantsUseCase
} from './application/usecases/tenant.usecases.js';

import {
  CreatePermissionUseCase,
  GetPermissionUseCase,
  UpdatePermissionUseCase,
  DeletePermissionUseCase,
  ListPermissionsUseCase
} from './application/usecases/permission.usecases.js';

import {
  CreateMFADeviceUseCase,
  GetMFADeviceUseCase,
  UpdateMFADeviceUseCase,
  DeleteMFADeviceUseCase,
  ListMFADevicesUseCase
} from './application/usecases/mfa_device.usecases.js';

describe('Identity CRUD Use Cases & Repositories Tests', () => {
  const tenantId = '00000000-0000-0000-0000-000000000001';
  const db = new PostgresDatabaseClient(new InMemoryDriver());

  const userRepo = new UserPgRepository(db);
  const roleRepo = new RolePgRepository(db);
  const tenantRepo = new TenantPgRepository(db);
  const permissionRepo = new PermissionPgRepository(db);
  const mfaRepo = new MFADevicePgRepository(db);

  // 1. USER TESTS
  describe('User CRUD Use Cases', () => {
    const createUser = new CreateUserUseCase(undefined, userRepo);
    const getUser = new GetUserUseCase(userRepo);
    const updateUser = new UpdateUserUseCase(undefined, userRepo);
    const deleteUser = new DeleteUserUseCase(userRepo);
    const listUsers = new ListUsersUseCase(userRepo);

    test('Should perform User lifecycle successfully', async () => {
      // Create
      const user = await createUser.execute(tenantId, {
        email: 'test-user@enterprise.com',
        password: 'my-pass-123',
        status: 'ACTIVE'
      });
      assert.strictEqual(user.email, 'test-user@enterprise.com');
      assert.strictEqual(user.status, 'ACTIVE');

      // Get
      const fetched = await getUser.execute(user.id, tenantId);
      assert.strictEqual(fetched.id, user.id);
      assert.strictEqual(fetched.email, 'test-user@enterprise.com');

      // Update
      const updated = await updateUser.execute(tenantId, {
        id: user.id,
        status: 'SUSPENDED'
      });
      assert.strictEqual(updated.status, 'SUSPENDED');

      // List
      const list = await listUsers.execute(tenantId);
      assert.ok(list.data.length > 0);

      // Delete
      const deleted = await deleteUser.execute(user.id, tenantId);
      assert.strictEqual(deleted, true);
    });
  });

  // 2. ROLE TESTS
  describe('Role CRUD Use Cases', () => {
    const createRole = new CreateRoleUseCase(undefined, roleRepo);
    const getRole = new GetRoleUseCase(roleRepo);
    const updateRole = new UpdateRoleUseCase(undefined, roleRepo);
    const deleteRole = new DeleteRoleUseCase(roleRepo);
    const listRoles = new ListRolesUseCase(roleRepo);

    test('Should perform Role lifecycle successfully', async () => {
      // Create
      const role = await createRole.execute(tenantId, {
        name: 'Manager',
        description: 'Store manager role',
        isSystem: false
      });
      assert.strictEqual(role.name, 'Manager');
      assert.strictEqual(role.description, 'Store manager role');

      // Get
      const fetched = await getRole.execute(role.id, tenantId);
      assert.strictEqual(fetched.name, 'Manager');

      // Update
      const updated = await updateRole.execute(tenantId, {
        id: role.id,
        description: 'Updated store manager description'
      });
      assert.strictEqual(updated.description, 'Updated store manager description');

      // List
      const list = await listRoles.execute(tenantId);
      assert.ok(list.data.length > 0);

      // Delete
      const deleted = await deleteRole.execute(role.id, tenantId);
      assert.strictEqual(deleted, true);
    });
  });

  // 3. TENANT TESTS
  describe('Tenant CRUD Use Cases', () => {
    const createTenant = new CreateTenantUseCase(undefined, tenantRepo);
    const getTenant = new GetTenantUseCase(tenantRepo);
    const updateTenant = new UpdateTenantUseCase(undefined, tenantRepo);
    const deleteTenant = new DeleteTenantUseCase(tenantRepo);
    const listTenants = new ListTenantsUseCase(tenantRepo);

    test('Should perform Tenant lifecycle successfully', async () => {
      // Create
      const tenant = await createTenant.execute(tenantId, {
        name: 'Enterprise Tenant B',
        status: 'ACTIVE'
      });
      assert.strictEqual(tenant.name, 'Enterprise Tenant B');

      // Get
      const fetched = await getTenant.execute(tenant.id, tenantId);
      assert.strictEqual(fetched.name, 'Enterprise Tenant B');

      // Update
      const updated = await updateTenant.execute(tenantId, {
        id: tenant.id,
        status: 'SUSPENDED'
      });
      assert.strictEqual(updated.status, 'SUSPENDED');

      // List
      const list = await listTenants.execute(tenantId);
      assert.ok(list.data.length > 0);

      // Delete
      const deleted = await deleteTenant.execute(tenant.id, tenantId);
      assert.strictEqual(deleted, true);
    });
  });

  // 4. PERMISSION TESTS
  describe('Permission CRUD Use Cases', () => {
    const createPerm = new CreatePermissionUseCase(undefined, permissionRepo);
    const getPerm = new GetPermissionUseCase(permissionRepo);
    const updatePerm = new UpdatePermissionUseCase(undefined, permissionRepo);
    const deletePerm = new DeletePermissionUseCase(permissionRepo);
    const listPerms = new ListPermissionsUseCase(permissionRepo);

    test('Should perform Permission lifecycle successfully', async () => {
      // Create
      const perm = await createPerm.execute(tenantId, {
        name: 'orders:create',
        resource: 'orders',
        action: 'create',
        description: 'Ability to create orders'
      });
      assert.strictEqual(perm.name, 'orders:create');

      // Get
      const fetched = await getPerm.execute(perm.id, tenantId);
      assert.strictEqual(fetched.name, 'orders:create');

      // Update
      const updated = await updatePerm.execute(tenantId, {
        id: perm.id,
        description: 'Updated ability to create orders'
      });
      assert.strictEqual(updated.description, 'Updated ability to create orders');

      // List
      const list = await listPerms.execute(tenantId);
      assert.ok(list.data.length > 0);

      // Delete
      const deleted = await deletePerm.execute(perm.id, tenantId);
      assert.strictEqual(deleted, true);
    });
  });

  // 5. MFA DEVICE TESTS
  describe('MFADevice CRUD Use Cases', () => {
    const createMfa = new CreateMFADeviceUseCase(undefined, mfaRepo);
    const getMfa = new GetMFADeviceUseCase(mfaRepo);
    const updateMfa = new UpdateMFADeviceUseCase(undefined, mfaRepo);
    const deleteMfa = new DeleteMFADeviceUseCase(mfaRepo);
    const listMfas = new ListMFADevicesUseCase(mfaRepo);

    test('Should perform MFADevice lifecycle successfully', async () => {
      // Create
      const mfa = await createMfa.execute(tenantId, {
        userId: 'user-email-123@domain.com',
        type: 'TOTP',
        secretEncrypted: 'my-secret-key-encrypted',
        isActive: true
      });
      assert.strictEqual(mfa.userId, 'user-email-123@domain.com');

      // Get
      const fetched = await getMfa.execute(mfa.id, tenantId);
      assert.strictEqual(fetched.userId, 'user-email-123@domain.com');

      // Update
      const updated = await updateMfa.execute(tenantId, {
        id: mfa.id,
        isActive: false
      });
      assert.strictEqual(updated.isActive, false);

      // List
      const list = await listMfas.execute(tenantId);
      assert.ok(list.data.length > 0);

      // Delete
      const deleted = await deleteMfa.execute(mfa.id, tenantId);
      assert.strictEqual(deleted, true);
    });
  });
});
