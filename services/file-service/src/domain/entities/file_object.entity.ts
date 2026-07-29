export type FileObjectStatus = 'PENDING' | 'UPLOADED' | 'ARCHIVED' | 'DELETED';

export interface FileObjectProps {
  id: string;
  tenantId: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  storagePath: string;
  checksum: string;
  status: FileObjectStatus;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export class FileObjectDomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FileObjectDomainError';
  }
}

export class FileObjectAggregate {
  private props: FileObjectProps;

  constructor(props: FileObjectProps) {
    this.validate(props);
    this.props = { ...props };
  }

  private validate(props: FileObjectProps): void {
    if (!props.id || props.id.trim().length === 0) {
      throw new FileObjectDomainError('FileObject ID is required.');
    }
    if (!props.tenantId || props.tenantId.trim().length === 0) {
      throw new FileObjectDomainError('FileObject tenantId is required.');
    }
    if (!props.filename || props.filename.trim().length === 0) {
      throw new FileObjectDomainError('FileObject filename is required.');
    }
    if (!props.mimeType || props.mimeType.trim().length === 0) {
      throw new FileObjectDomainError('FileObject mimeType is required.');
    }
    if (props.sizeBytes < 0) {
      throw new FileObjectDomainError('FileObject sizeBytes must be non-negative.');
    }
    if (!props.storagePath || props.storagePath.trim().length === 0) {
      throw new FileObjectDomainError('FileObject storagePath is required.');
    }
    if (!props.checksum || props.checksum.trim().length === 0) {
      throw new FileObjectDomainError('FileObject checksum is required.');
    }

    const validStatuses: FileObjectStatus[] = ['PENDING', 'UPLOADED', 'ARCHIVED', 'DELETED'];
    if (!props.status || !validStatuses.includes(props.status)) {
      throw new FileObjectDomainError(`Invalid FileObject status: ${props.status}`);
    }

    if (props.version < 1) {
      throw new FileObjectDomainError('FileObject version must be >= 1.');
    }
  }

  public static create(params: {
    id: string;
    tenantId: string;
    filename: string;
    mimeType: string;
    sizeBytes: number;
    storagePath: string;
    checksum: string;
    status?: FileObjectStatus;
  }): FileObjectAggregate {
    const now = new Date();
    return new FileObjectAggregate({
      id: params.id,
      tenantId: params.tenantId,
      filename: params.filename,
      mimeType: params.mimeType,
      sizeBytes: params.sizeBytes,
      storagePath: params.storagePath,
      checksum: params.checksum,
      status: params.status ?? 'PENDING',
      version: 1,
      createdAt: now,
      updatedAt: now
    });
  }

  public markUploaded(expectedVersion: number): void {
    this.assertVersion(expectedVersion);
    if (this.props.status !== 'PENDING') {
      throw new FileObjectDomainError(`Cannot transition from ${this.props.status} to UPLOADED.`);
    }
    this.props.status = 'UPLOADED';
    this.props.version += 1;
    this.props.updatedAt = new Date();
  }

  public approve(): void {
    if (this.props.status === 'PENDING') {
      this.props.status = 'UPLOADED';
      this.props.version += 1;
      this.props.updatedAt = new Date();
    }
  }

  public archive(expectedVersion: number): void {
    this.assertVersion(expectedVersion);
    if (this.props.status !== 'UPLOADED') {
      throw new FileObjectDomainError(`Cannot archive FileObject in status ${this.props.status}. Must be UPLOADED.`);
    }
    this.props.status = 'ARCHIVED';
    this.props.version += 1;
    this.props.updatedAt = new Date();
  }

  public markDeleted(expectedVersion: number): void {
    this.assertVersion(expectedVersion);
    if (this.props.status === 'DELETED') {
      throw new FileObjectDomainError('FileObject is already DELETED.');
    }
    this.props.status = 'DELETED';
    this.props.version += 1;
    this.props.updatedAt = new Date();
  }

  public updateMetadata(filename: string, expectedVersion: number): void {
    this.assertVersion(expectedVersion);
    if (!filename || filename.trim().length === 0) {
      throw new FileObjectDomainError('FileObject filename cannot be empty.');
    }
    this.props.filename = filename.trim();
    this.props.version += 1;
    this.props.updatedAt = new Date();
  }

  private assertVersion(expectedVersion: number): void {
    if (this.props.version !== expectedVersion) {
      throw new FileObjectDomainError(`Optimistic locking failure: expected version ${expectedVersion}, found ${this.props.version}`);
    }
  }

  public get id(): string { return this.props.id; }
  public get tenantId(): string { return this.props.tenantId; }
  public get filename(): string { return this.props.filename; }
  public get mimeType(): string { return this.props.mimeType; }
  public get sizeBytes(): number { return this.props.sizeBytes; }
  public get storagePath(): string { return this.props.storagePath; }
  public get checksum(): string { return this.props.checksum; }
  public get status(): FileObjectStatus { return this.props.status; }
  public get version(): number { return this.props.version; }
  public get createdAt(): Date { return this.props.createdAt; }
  public get updatedAt(): Date { return this.props.updatedAt; }
}
