import { ReportPgRepository } from './infrastructure/database/repositories/report.pg-repository.js';
import { CreateReportUseCase } from './application/usecases/create-report.usecase.js';
import { GetReportUseCase } from './application/usecases/get-report.usecase.js';
import { UpdateReportUseCase } from './application/usecases/update-report.usecase.js';
import { ListReportsUseCase } from './application/usecases/list-reports.usecase.js';
import { ReportController } from './presentation/rest/controllers/report.controller.js';

const repo = new ReportPgRepository();
const createUseCase = new CreateReportUseCase(repo);
const getUseCase = new GetReportUseCase(repo);
const updateUseCase = new UpdateReportUseCase(repo);
const listUseCase = new ListReportsUseCase(repo);

const controller = new ReportController(createUseCase, getUseCase, updateUseCase, listUseCase);

async function bootstrap(): Promise<void> {
  process.stdout.write('\n=== REPORT-SERVICE BOOTSTRAP ===\n');

  const req = {
    headers: {
      'content-type': 'application/json',
      'x-tenant-id': '00000000-0000-0000-0000-000000000001',
      'x-user-id': 'admin-1',
      'x-user-roles': 'admin',
      'x-user-permissions': 'report:create,report:read,report:update,report:delete'
    },
    body: {
      name: 'Q2 Sales & Distribution Summary',
      type: 'SALES',
      parameters: { startDate: '2026-04-01', endDate: '2026-06-30' }
    }
  };

  const createRes = await controller.handleCreate(req);
  process.stdout.write(`\n📊 Create Report Result (status=${createRes.statusCode}):\n${JSON.stringify(createRes.body, null, 2)}\n`);

  const listRes = await controller.handleList({ headers: req.headers, query: { page: 1, pageSize: 10 } });
  process.stdout.write(`\n📋 Reports List (count=${listRes.body.total}):\n${JSON.stringify(listRes.body, null, 2)}\n`);

  process.stdout.write('\n=== REPORT-SERVICE BOOTSTRAP COMPLETE ===\n');
}

bootstrap();
