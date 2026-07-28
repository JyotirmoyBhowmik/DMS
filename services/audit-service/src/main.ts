import { AuditLogPgRepository } from './infrastructure/database/repositories/audit_log.pg-repository.js';
import { CreateAuditLogUseCase } from './application/usecases/create-audit-log.usecase.js';
import { GetAuditLogUseCase } from './application/usecases/get-audit-log.usecase.js';
import { UpdateAuditLogUseCase } from './application/usecases/update-audit-log.usecase.js';
import { ListAuditLogsUseCase } from './application/usecases/list-audit-logs.usecase.js';
import { AuditLogController } from './presentation/rest/controllers/audit_log.controller.js';

const repo = new AuditLogPgRepository();
const createUseCase = new CreateAuditLogUseCase(repo);
const getUseCase = new GetAuditLogUseCase(repo);
const updateUseCase = new UpdateAuditLogUseCase(repo);
const listUseCase = new ListAuditLogsUseCase(repo);

const controller = new AuditLogController(createUseCase, getUseCase, updateUseCase, listUseCase);

async function bootstrap(): Promise<void> {
  process.stdout.write('\n=== AUDIT-SERVICE BOOTSTRAP ===\n');

  const req = {
    headers: {
      'content-type': 'application/json',
      'x-tenant-id': '00000000-0000-0000-0000-000000000001',
      'x-user-id': 'admin-1',
      'x-user-roles': 'admin',
      'x-user-permissions': 'audit:create,audit:read,audit:update,audit:delete'
    },
    body: {
      actorId: 'user-admin-1',
      action: 'USER_LOGIN',
      entityType: 'User',
      entityId: 'user-admin-1',
      source: 'WEB',
      details: { ip: '127.0.0.1', passwordToken: 'secret' }
    }
  };

  const createRes = await controller.handleCreate(req);
  process.stdout.write(`\n📜 Create AuditLog Result (status=${createRes.statusCode}):\n${JSON.stringify(createRes.body, null, 2)}\n`);

  const listRes = await controller.handleList({ headers: req.headers, query: { page: 1, pageSize: 10 } });
  process.stdout.write(`\n📋 AuditLogs List (count=${listRes.body.total}):\n${JSON.stringify(listRes.body, null, 2)}\n`);

  process.stdout.write('\n=== AUDIT-SERVICE BOOTSTRAP COMPLETE ===\n');
}

bootstrap();
