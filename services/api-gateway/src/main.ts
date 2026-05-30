import { GatewayController } from './presentation/rest/controllers/gateway.controller.js';

const gateway = new GatewayController();

async function bootstrap(): Promise<void> {
  process.stdout.write('\n=== API-GATEWAY BOOTSTRAP ===\n');

  // Health check
  const health = gateway.handleHealthCheck();
  process.stdout.write(`\n💓 Health: ${JSON.stringify(health.body, null, 2)}\n`);

  // List routes
  const routes = gateway.handleListRoutes();
  process.stdout.write(`\n📋 Routes: ${(routes.body as Record<string, unknown>).count} registered\n`);

  // Simulate a request with a mock JWT
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({
    sub: 'user-1',
    tenantId: 'tenant-uuid-1111',
    roles: ['admin'],
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
  })).toString('base64url');
  const mockJwt = `${header}.${payload}.mock-signature`;

  const result = await gateway.handleRequest({
    method: 'GET',
    path: '/api/v1/orders',
    headers: {
      'authorization': `Bearer ${mockJwt}`,
      'x-tenant-id': 'tenant-uuid-1111',
    },
  });

  process.stdout.write(`\n🔀 Routed Request (status=${result.status}):\n${JSON.stringify(result.body, null, 2)}\n`);
  process.stdout.write('\n=== API-GATEWAY BOOTSTRAP COMPLETE ===\n');
}

bootstrap();
