import http from 'node:http';
import { GatewayController } from '../src/presentation/rest/controllers/gateway.controller.js';

const gateway = new GatewayController();

export default async function handler(req: http.IncomingMessage, res: http.ServerResponse) {
  const urlParts = (req.url || '/').split('?');
  const path = urlParts[0];

  // Enable CORS headers
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
      routes: '/api/v1/routes'
    }));
    return;
  }

  // Handle Health Check
  if (path === '/health' || path === '/api/v1/health') {
    const health = gateway.handleHealthCheck();
    res.statusCode = health.status || 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(health.body));
    return;
  }

  // Handle Routes List
  if (path === '/routes' || path === '/api/v1/routes') {
    const routes = gateway.handleListRoutes();
    res.statusCode = routes.status || 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(routes.body));
    return;
  }

  // Read body for POST/PUT/PATCH
  let bodyData: any = undefined;
  if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
    const buffers: Uint8Array[] = [];
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

  // Convert headers
  const headers: Record<string, string> = {};
  for (const [k, v] of Object.entries(req.headers)) {
    if (typeof v === 'string') {
      headers[k.toLowerCase()] = v;
    } else if (Array.isArray(v)) {
      headers[k.toLowerCase()] = v.join(', ');
    }
  }

  try {
    const result = await gateway.handleRequest({
      method: req.method || 'GET',
      path,
      headers,
      body: bodyData
    });

    res.statusCode = result.status || 200;
    for (const [k, v] of Object.entries(result.headers || {})) {
      res.setHeader(k, v);
    }
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(result.body));
  } catch (err: any) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Internal Server Error', message: err.message }));
  }
}
