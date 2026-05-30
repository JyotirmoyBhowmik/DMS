import { FileController } from './presentation/rest/controllers/file.controller.js';

const controller = new FileController();

async function bootstrap(): Promise<void> {
  process.stdout.write('\n=== FILE-SERVICE BOOTSTRAP ===\n');

  // Initiate upload
  const upload = await controller.handleInitiateUpload({
    tenantId: 'tenant-uuid-1111', uploaderId: 'user-uuid-2222',
    originalName: 'sales-report-march.xlsx',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    sizeBytes: 1_024_000, tags: ['report', 'sales', 'march'],
  });
  process.stdout.write(`\n📤 Upload Initiated (status=${upload.status}):\n${JSON.stringify(upload.body, null, 2)}\n`);

  const fileId = upload.body.fileId as string;

  // Complete upload (triggers scan)
  const complete = await controller.handleCompleteUpload(fileId);
  process.stdout.write(`\n✅ Upload Completed (status=${complete.status}): scanResult=${(complete.body as Record<string, unknown>).scanResult ?? 'clean'}\n`);

  // Download
  if (complete.status === 200) {
    const download = await controller.handleDownload(fileId);
    process.stdout.write(`\n📥 Download URL: ${(download.body as Record<string, unknown>).downloadUrl}\n`);
  }

  // Test MIME rejection
  const rejected = await controller.handleInitiateUpload({
    tenantId: 'tenant-uuid-1111', uploaderId: 'user-uuid-2222',
    originalName: 'malware.exe', mimeType: 'application/x-executable', sizeBytes: 500,
  });
  process.stdout.write(`\n🚫 MIME Rejection (status=${rejected.status}): ${JSON.stringify(rejected.body)}\n`);

  process.stdout.write('\n=== FILE-SERVICE BOOTSTRAP COMPLETE ===\n');
}

bootstrap();
