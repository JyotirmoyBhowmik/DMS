export class RbacGuard {
  static hasPermission(userRoles: string[], requiredPermission: string): boolean {
    const permissionMap: Record<string, string[]> = {
      admin: ['*'],
      agent: ['visit:create', 'visit:read', 'order:create', 'order:read'],
      distributor: ['inventory:read', 'inventory:update', 'order:read'],
    };
    for (const role of userRoles) {
      const perms = permissionMap[role];
      if (perms) {
        if (perms.includes('*') || perms.includes(requiredPermission)) {
          return true;
        }
      }
    }
    return false;
  }
}
