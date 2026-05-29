export class TestFactories {
  static createMockUser(overrides: any = {}): any {
    return {
      id: 'mock-user-uuid-1234',
      email: 'mockagent@enterprise-dms.com',
      roles: ['agent'],
      tenantId: 'mock-tenant-id',
      ...overrides
    };
  }
}
