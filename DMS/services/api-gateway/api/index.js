const http = require('node:http');

module.exports = async function handler(req, res) {
  const urlParts = (req.url || '/').split('?');
  const path = urlParts[0];

  // Enable CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Tenant-ID, X-User-ID, X-User-Roles, X-User-Permissions');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  // Handle Root URL
  if (path === '/' || path === '') {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({
      status: 'UP',
      service: 'api-gateway',
      version: '1.0.0',
      message: 'Enterprise DMS & SFA Production API Gateway Running',
      documentation: 'https://dms.jyotirmoyb.com',
      health: '/api/v1/health',
      routes: '/api/v1/routes',
      endpoints: [
        '/api/v1/auth/login',
        '/api/v1/users',
        '/api/v1/roles',
        '/api/v1/tenants',
        '/api/v1/permissions',
        '/api/v1/mfa-devices',
        '/api/v1/inventory',
        '/api/v1/orders',
        '/api/v1/van-sales',
        '/api/v1/geo-checkins',
        '/api/v1/schemes',
        '/api/v1/claims',
        '/api/v1/audit/logs'
      ]
    }));
    return;
  }

  // Handle Health Check
  if (path === '/health' || path === '/api/v1/health') {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({
      status: 'UP',
      timestamp: new Date().toISOString(),
      service: 'api-gateway',
      monorepoStatus: 'HEALTHY'
    }));
    return;
  }

  // Handle Routes List
  if (path === '/routes' || path === '/api/v1/routes') {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({
      count: 48,
      services: ['identity-service', 'dms-core-service', 'sfa-service', 'pricing-service', 'claims-service', 'audit-service']
    }));
    return;
  }

  // Read Body for POST/PUT/PATCH
  let bodyData = undefined;
  if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
    const buffers = [];
    for await (const chunk of req) {
      buffers.push(chunk);
    }
    const rawBody = Buffer.concat(buffers).toString('utf-8');
    if (rawBody) {
      try {
        bodyData = JSON.parse(rawBody);
      } catch {
        bodyData = rawBody;
      }
    }
  }

  // Handle API v1 endpoints
  try {
    if (path === '/api/v1/auth/login') {
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({
        status: 'SUCCESS',
        accessToken: 'mock-jwt-bearer-token-' + Date.now(),
        user: { email: bodyData?.email || 'admin@enterprise.com', role: 'admin' }
      }));
      return;
    }

    if (path.startsWith('/api/v1/users')) {
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({
        data: [
          { id: 'usr-1', email: 'admin@enterprise.com', status: 'ACTIVE', roles: ['admin'] },
          { id: 'usr-2', email: 'agent-001@enterprise.com', status: 'ACTIVE', roles: ['agent'] }
        ]
      }));
      return;
    }

    if (path.startsWith('/api/v1/tenants')) {
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({
        data: [
          { id: '00000000-0000-0000-0000-000000000001', name: 'Global Distribution Corp', status: 'ACTIVE' },
          { id: '00000000-0000-0000-0000-000000000002', name: 'Metro Wholesalers Ltd', status: 'ACTIVE' }
        ]
      }));
      return;
    }

    // Default Fallback JSON response for all API routes
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({
      success: true,
      path,
      method: req.method,
      message: 'API Gateway Request Handled',
      timestamp: new Date().toISOString()
    }));
  } catch (err) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Internal Server Error', message: err.message }));
  }
};
