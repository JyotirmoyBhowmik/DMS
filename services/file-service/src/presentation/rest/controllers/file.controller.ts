import { createHash, randomUUID } from 'node:crypto';

export type FileStatus = 'uploading' | 'available' | 'quarantined' | 'deleted';
export type ScanResult = 'clean' | 'infected' | 'pending';

export interface FileMetadataProps {
  id: string; tenantId: string; uploaderId: string; filename: string; originalName: string;
  mimeType: string; sizeBytes: number; storageKey: string; bucketName: string;
  checksumSha256: string; status: FileStatus; scanResult: ScanResult; tags: string[];
  expiresAt: string | null; createdAt: string; updatedAt: string;
}

export class FileMetadata {
  private props: FileMetadataProps;

  private constructor(props: FileMetadataProps) { this.props = { ...props }; }

  static create(input: {
    tenantId: string; uploaderId: string; originalName: string; mimeType: string; sizeBytes: number; tags?: string[];
  }): FileMetadata {
    const id = randomUUID();
    const ext = input.originalName.split('.').pop() ?? '';
    const now = new Date();
    const storageKey = `${input.tenantId}/${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${id}/${input.originalName}`;
    return new FileMetadata({
      id, tenantId: input.tenantId, uploaderId: input.uploaderId, filename: `${id}.${ext}`,
      originalName: input.originalName, mimeType: input.mimeType, sizeBytes: input.sizeBytes,
      storageKey, bucketName: 'dms-files', checksumSha256: '', status: 'uploading', scanResult: 'pending',
      tags: input.tags ?? [], expiresAt: null, createdAt: now.toISOString(), updatedAt: now.toISOString(),
    });
  }

  static reconstitute(props: FileMetadataProps): FileMetadata { return new FileMetadata(props); }

  get id(): string { return this.props.id; }
  get tenantId(): string { return this.props.tenantId; }
  get storageKey(): string { return this.props.storageKey; }
  get status(): FileStatus { return this.props.status; }
  get scanResult(): ScanResult { return this.props.scanResult; }
  get mimeType(): string { return this.props.mimeType; }
  get sizeBytes(): number { return this.props.sizeBytes; }
  get originalName(): string { return this.props.originalName; }

  markAvailable(checksum: string): void {
    this.props.status = 'available'; this.props.checksumSha256 = checksum;
    this.props.scanResult = 'clean'; this.props.updatedAt = new Date().toISOString();
  }

  markQuarantined(): void {
    this.props.status = 'quarantined'; this.props.scanResult = 'infected'; this.props.updatedAt = new Date().toISOString();
  }

  softDelete(): void { this.props.status = 'deleted'; this.props.updatedAt = new Date().toISOString(); }

  toJSON(): Record<string, unknown> { return { ...this.props }; }
}

// ── Errors ────────────────────────────────────────────────────
export class FileTooLargeError extends Error {
  constructor(size: number, max: number) { super(`File size ${size} exceeds max ${max}`); this.name = 'FileTooLargeError'; }
}
export class UnsupportedMimeTypeError extends Error {
  constructor(mime: string) { super(`Unsupported MIME type: ${mime}`); this.name = 'UnsupportedMimeTypeError'; }
}
export class FileNotFoundError extends Error {
  constructor(id: string) { super(`File '${id}' not found`); this.name = 'FileNotFoundError'; }
}

// ── Repository ────────────────────────────────────────────────
class InMemoryFileRepository {
  private store = new Map<string, FileMetadataProps>();

  async save(file: FileMetadata): Promise<void> {
    this.store.set(file.id, file.toJSON() as unknown as FileMetadataProps);
  }

  async findById(id: string): Promise<FileMetadata | null> {
    const data = this.store.get(id);
    return data ? FileMetadata.reconstitute(data) : null;
  }

  async findByTenant(tenantId: string, limit = 20): Promise<FileMetadata[]> {
    return Array.from(this.store.values()).filter((f) => f.tenantId === tenantId).slice(0, limit).map((f) => FileMetadata.reconstitute(f));
  }
}

// ── Mock Storage Adapter ────────────────────────────────────────
class MockStorageAdapter {
  private storage = new Map<string, Buffer>();

  async putObject(key: string, data: Buffer): Promise<void> { this.storage.set(key, data); }
  async getObject(key: string): Promise<Buffer | null> { return this.storage.get(key) ?? null; }
  async deleteObject(key: string): Promise<void> { this.storage.delete(key); }
  generatePresignedUrl(key: string, expiresInSec = 3600): string {
    return `https://dms-files.s3.amazonaws.com/${key}?X-Amz-Expires=${expiresInSec}&X-Amz-Signature=mock-sig-${randomUUID().slice(0, 8)}`;
  }
}

// ── Mock Scanner ────────────────────────────────────────────────
class MockScannerAdapter {
  async scan(_key: string): Promise<'clean' | 'infected'> { return Math.random() > 0.05 ? 'clean' : 'infected'; }
}

// ── Allowed MIME types ────────────────────────────────────────
const ALLOWED_MIMES = new Set([
  'image/jpeg', 'image/png', 'image/webp', 'application/pdf',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel', 'text/csv', 'application/json',
]);
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

// ── Controller ────────────────────────────────────────────────
export class FileController {
  private readonly repo: InMemoryFileRepository;
  private readonly storage: MockStorageAdapter;
  private readonly scanner: MockScannerAdapter;

  constructor() {
    this.repo = new InMemoryFileRepository();
    this.storage = new MockStorageAdapter();
    this.scanner = new MockScannerAdapter();
  }

  async handleInitiateUpload(body: {
    tenantId: string; uploaderId: string; originalName: string; mimeType: string; sizeBytes: number; tags?: string[];
  }): Promise<{ status: number; body: Record<string, unknown> }> {
    if (!ALLOWED_MIMES.has(body.mimeType)) {
      return { status: 400, body: { error: `Unsupported MIME type: ${body.mimeType}`, code: 'UNSUPPORTED_MIME' } };
    }
    if (body.sizeBytes > MAX_FILE_SIZE) {
      return { status: 400, body: { error: `File too large: ${body.sizeBytes} > ${MAX_FILE_SIZE}`, code: 'FILE_TOO_LARGE' } };
    }

    const file = FileMetadata.create(body);
    const uploadUrl = this.storage.generatePresignedUrl(file.storageKey, 900);
    await this.repo.save(file);

    return { status: 201, body: { fileId: file.id, uploadUrl, storageKey: file.storageKey, expiresIn: 900 } };
  }

  async handleCompleteUpload(fileId: string): Promise<{ status: number; body: Record<string, unknown> }> {
    const file = await this.repo.findById(fileId);
    if (!file) return { status: 404, body: { error: 'File not found' } };

    const scanResult = await this.scanner.scan(file.storageKey);
    const checksum = createHash('sha256').update(`file-content-${fileId}`).digest('hex');

    if (scanResult === 'infected') {
      file.markQuarantined();
      await this.repo.save(file);
      return { status: 422, body: { error: 'File flagged as infected', fileId, scanResult: 'infected' } };
    }

    file.markAvailable(checksum);
    await this.repo.save(file);
    return { status: 200, body: file.toJSON() };
  }

  async handleDownload(fileId: string): Promise<{ status: number; body: Record<string, unknown> }> {
    const file = await this.repo.findById(fileId);
    if (!file) return { status: 404, body: { error: 'File not found' } };
    if (file.status !== 'available') return { status: 400, body: { error: `File not available (status=${file.status})` } };

    const downloadUrl = this.storage.generatePresignedUrl(file.storageKey, 3600);
    return { status: 200, body: { fileId, downloadUrl, mimeType: file.mimeType, originalName: file.originalName } };
  }

  async handleDelete(fileId: string): Promise<{ status: number; body: Record<string, unknown> }> {
    const file = await this.repo.findById(fileId);
    if (!file) return { status: 404, body: { error: 'File not found' } };
    file.softDelete();
    await this.repo.save(file);
    return { status: 200, body: { fileId, status: 'deleted' } };
  }
}
