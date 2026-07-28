import { FileObjectPgRepository } from './infrastructure/database/repositories/file_object.pg-repository.js';
import { CreateFileObjectUseCase } from './application/usecases/create-file-object.usecase.js';
import { GetFileObjectUseCase } from './application/usecases/get-file-object.usecase.js';
import { UpdateFileObjectUseCase } from './application/usecases/update-file-object.usecase.js';
import { ListFileObjectsUseCase } from './application/usecases/list-file-objects.usecase.js';
import { FileObjectController } from './presentation/rest/controllers/file_object.controller.js';

const repo = new FileObjectPgRepository();
const createUseCase = new CreateFileObjectUseCase(repo);
const getUseCase = new GetFileObjectUseCase(repo);
const updateUseCase = new UpdateFileObjectUseCase(repo);
const listUseCase = new ListFileObjectsUseCase(repo);

const controller = new FileObjectController(createUseCase, getUseCase, updateUseCase, listUseCase);

async function bootstrap(): Promise<void> {
  process.stdout.write('\n=== FILE-SERVICE BOOTSTRAP ===\n');

  const req = {
    headers: {
      'content-type': 'application/json',
      'x-tenant-id': '00000000-0000-0000-0000-000000000001',
      'x-user-id': 'admin-1',
      'x-user-roles': 'admin',
      'x-user-permissions': 'file:create,file:read,file:update,file:delete'
    },
    body: {
      filename: 'invoice-2026-001.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 1048576,
      storagePath: '/s3/documents/invoice-2026-001.pdf',
      checksum: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
    }
  };

  const createRes = await controller.handleCreate(req);
  process.stdout.write(`\n📄 Create FileObject Result (status=${createRes.statusCode}):\n${JSON.stringify(createRes.body, null, 2)}\n`);

  const listRes = await controller.handleList({ headers: req.headers, query: { page: 1, pageSize: 10 } });
  process.stdout.write(`\n📋 FileObjects List (count=${listRes.body.total}):\n${JSON.stringify(listRes.body, null, 2)}\n`);

  process.stdout.write('\n=== FILE-SERVICE BOOTSTRAP COMPLETE ===\n');
}

bootstrap();
