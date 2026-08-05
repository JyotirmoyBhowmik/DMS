export interface UploadPart {
  partNumber: number;
  etag: string;
  sizeBytes: number;
}

export interface MultipartUploadSession {
  uploadId: string;
  fileId: string;
  tenantId: string;
  bucket: string;
  key: string;
  completedParts: UploadPart[];
  isCompleted: boolean;
  virusScanStatus: 'PENDING' | 'CLEAN' | 'INFECTED';
}

export class S3ChunkedUploadService {
  private sessions = new Map<string, MultipartUploadSession>();

  async initiateMultipartUpload(fileId: string, tenantId: string, filename: string): Promise<MultipartUploadSession> {
    const uploadId = `mpu-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const session: MultipartUploadSession = {
      uploadId,
      fileId,
      tenantId,
      bucket: 'dms-file-storage-bucket',
      key: `tenants/${tenantId}/files/${fileId}/${filename}`,
      completedParts: [],
      isCompleted: false,
      virusScanStatus: 'PENDING',
    };
    this.sessions.set(uploadId, session);
    return session;
  }

  async uploadChunk(uploadId: string, partNumber: number, chunkBuffer: Buffer): Promise<UploadPart> {
    const session = this.sessions.get(uploadId);
    if (!session) {
      throw new Error(`Upload session ${uploadId} not found`);
    }
    if (session.isCompleted) {
      throw new Error(`Upload session ${uploadId} is already completed`);
    }

    const etag = `etag-part-${partNumber}-${chunkBuffer.length}`;
    const part: UploadPart = {
      partNumber,
      etag,
      sizeBytes: chunkBuffer.length,
    };

    const existingIdx = session.completedParts.findIndex(p => p.partNumber === partNumber);
    if (existingIdx >= 0) {
      session.completedParts[existingIdx] = part;
    } else {
      session.completedParts.push(part);
    }

    return part;
  }

  async completeMultipartUpload(uploadId: string): Promise<MultipartUploadSession> {
    const session = this.sessions.get(uploadId);
    if (!session) {
      throw new Error(`Upload session ${uploadId} not found`);
    }

    session.completedParts.sort((a, b) => a.partNumber - b.partNumber);
    session.isCompleted = true;
    session.virusScanStatus = 'CLEAN'; // ClamAV mock scan clean pass
    return session;
  }

  async getSessionStatus(uploadId: string): Promise<MultipartUploadSession | null> {
    return this.sessions.get(uploadId) ?? null;
  }
}
