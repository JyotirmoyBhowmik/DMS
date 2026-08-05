import { InvalidPhotoCaptureStateError } from '../errors/domain-error.js';

export type PhotoCaptureStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED';

export interface PhotoCaptureProps {
  id: string;
  tenantId: string;
  agentId: string;
  outletId: string;
  captureDate: string; // YYYY-MM-DD
  photoUrl: string;
  tags: string[];
  notes: string | null;
  status: PhotoCaptureStatus;
  createdAt: Date;
  updatedAt: Date;
  version: number;
}

export class PhotoCapture {
  private props: PhotoCaptureProps;

  private constructor(props: PhotoCaptureProps) {
    this.props = {
      ...props,
      tags: [...props.tags],
    };
  }

  static create(input: {
    id: string;
    tenantId: string;
    agentId: string;
    outletId: string;
    captureDate: string;
    photoUrl: string;
    tags?: string[];
    notes?: string | null;
    status?: PhotoCaptureStatus;
  }): PhotoCapture {
    if (!input.id || input.id.trim().length === 0) throw new Error('ID cannot be empty');
    if (!input.tenantId || input.tenantId.trim().length === 0) throw new Error('tenantId cannot be empty');
    if (!input.agentId || input.agentId.trim().length === 0) throw new Error('agentId cannot be empty');
    if (!input.outletId || input.outletId.trim().length === 0) throw new Error('outletId cannot be empty');
    if (!input.captureDate || input.captureDate.trim().length === 0) throw new Error('captureDate cannot be empty');
    
    if (!input.photoUrl || input.photoUrl.trim().length === 0) {
      throw new Error('photoUrl cannot be empty');
    }
    if (!input.photoUrl.startsWith('http://') && !input.photoUrl.startsWith('https://')) {
      throw new Error('photoUrl must be a valid URL');
    }

    const now = new Date();
    return new PhotoCapture({
      id: input.id,
      tenantId: input.tenantId,
      agentId: input.agentId,
      outletId: input.outletId,
      captureDate: input.captureDate,
      photoUrl: input.photoUrl,
      tags: input.tags ?? [],
      notes: input.notes ?? null,
      status: input.status ?? 'DRAFT',
      createdAt: now,
      updatedAt: now,
      version: 0,
    });
  }

  static reconstitute(props: PhotoCaptureProps): PhotoCapture {
    return new PhotoCapture(props);
  }

  // Getters
  get id(): string { return this.props.id; }
  get tenantId(): string { return this.props.tenantId; }
  get agentId(): string { return this.props.agentId; }
  get outletId(): string { return this.props.outletId; }
  get captureDate(): string { return this.props.captureDate; }
  get photoUrl(): string { return this.props.photoUrl; }
  get tags(): string[] { return [...this.props.tags]; }
  get notes(): string | null { return this.props.notes; }
  get status(): PhotoCaptureStatus { return this.props.status; }
  get createdAt(): Date { return this.props.createdAt; }
  get updatedAt(): Date { return this.props.updatedAt; }
  get version(): number { return this.props.version; }

  // Mutations
  updatePhotoUrl(url: string): void {
    if (this.props.status !== 'DRAFT') {
      throw new Error('Can only mutate photo capture in DRAFT status');
    }
    if (!url || url.trim().length === 0) {
      throw new Error('photoUrl cannot be empty');
    }
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      throw new Error('photoUrl must be a valid URL');
    }
    this.props.photoUrl = url;
    this.props.updatedAt = new Date();
  }

  updateTags(tags: string[]): void {
    if (this.props.status !== 'DRAFT') {
      throw new Error('Can only mutate photo capture in DRAFT status');
    }
    this.props.tags = [...tags];
    this.props.updatedAt = new Date();
  }

  updateNotes(notes: string | null): void {
    if (this.props.status !== 'DRAFT') {
      throw new Error('Can only mutate photo capture in DRAFT status');
    }
    this.props.notes = notes;
    this.props.updatedAt = new Date();
  }

  // State transitions
  submit(): void {
    if (this.props.status !== 'DRAFT') {
      throw new InvalidPhotoCaptureStateError(this.props.status, 'SUBMITTED');
    }
    this.props.status = 'SUBMITTED';
    this.props.updatedAt = new Date();
  }

  approve(): void {
    if (this.props.status !== 'SUBMITTED') {
      throw new InvalidPhotoCaptureStateError(this.props.status, 'APPROVED');
    }
    this.props.status = 'APPROVED';
    this.props.updatedAt = new Date();
  }

  reject(reason: string): void {
    if (this.props.status !== 'SUBMITTED') {
      throw new InvalidPhotoCaptureStateError(this.props.status, 'REJECTED');
    }
    if (!reason || reason.trim().length === 0) {
      throw new Error('Rejection reason is required');
    }
    this.props.status = 'REJECTED';
    this.props.notes = reason;
    this.props.updatedAt = new Date();
  }

  incrementVersion(): void {
    this.props.version += 1;
  }

  toJSON(): Record<string, unknown> {
    return {
      id: this.props.id,
      tenantId: this.props.tenantId,
      agentId: this.props.agentId,
      outletId: this.props.outletId,
      captureDate: this.props.captureDate,
      photoUrl: this.props.photoUrl,
      tags: this.props.tags,
      notes: this.props.notes,
      status: this.props.status,
      createdAt: this.props.createdAt.toISOString(),
      updatedAt: this.props.updatedAt.toISOString(),
      version: this.props.version,
    };
  }
}
