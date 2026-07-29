import { FileObjectAggregate } from '../../domain/entities/file_object.entity.js';
import { FileObjectRepository } from '../../domain/repositories/file_object.repository.js';
import { sanitizeFilename } from '../../domain/validation/file_object.validation.js';
import { FileObjectAuditService } from '../../infrastructure/audit/file_object.audit.js';
import { FileObjectResponseDto, UpdateFileObjectDto } from '../dtos/file_object.dto.js';
import { Principal } from './create-file-object.usecase.js';

export class UpdateFileObjectUseCase {
  constructor(
    private readonly repository: FileObjectRepository,
    private readonly auditService: FileObjectAuditService = new FileObjectAuditService()
  ) {}

  public async execute(principal: Principal, id: string, dto: UpdateFileObjectDto): Promise<FileObjectResponseDto> {
    if (!principal || !principal.tenantId) {
      throw new Error('Unauthorized: Tenant context required.');
    }
    if (!principal.permissions.includes('file:update') && !principal.roles.includes('admin')) {
      throw new Error('Forbidden: Insufficient permissions to update file object.');
    }

    const fileObject = await this.repository.findById(id, principal.tenantId);
    if (!fileObject) {
      throw new Error(`FileObject with ID '${id}' not found.`);
    }

    const oldState = { filename: fileObject.filename, status: fileObject.status, version: fileObject.version };

    if (dto.filename) {
      const cleanName = sanitizeFilename(dto.filename);
      fileObject.updateMetadata(cleanName, dto.expectedVersion);
    } else if (dto.status) {
      if (dto.status === 'UPLOADED') {
        fileObject.markUploaded(dto.expectedVersion);
      } else if (dto.status === 'ARCHIVED') {
        fileObject.archive(dto.expectedVersion);
      } else if (dto.status === 'DELETED') {
        fileObject.markDeleted(dto.expectedVersion);
      }
    }

    await this.repository.save(fileObject);

    await this.auditService.recordMutation({
      tenantId: principal.tenantId,
      actorId: principal.userId,
      action: 'FILE_OBJECT_UPDATED',
      entityId: fileObject.id,
      oldValue: oldState,
      newValue: { filename: fileObject.filename, status: fileObject.status, version: fileObject.version }
    });

    return this.mapToResponse(fileObject);
  }

  public async approveFileObject(principal: Principal, id: string): Promise<FileObjectResponseDto> {
    if (!principal || !principal.tenantId) {
      throw new Error('Unauthorized: Tenant context required.');
    }
    if (!principal.permissions.includes('file:approve') && !principal.roles.includes('admin')) {
      throw new Error('Forbidden: Insufficient permissions to approve file object.');
    }

    const fileObject = await this.repository.findById(id, principal.tenantId);
    if (!fileObject) {
      throw new Error(`FileObject with ID '${id}' not found.`);
    }

    const oldStatus = fileObject.status;
    fileObject.approve();

    await this.repository.save(fileObject);

    await this.auditService.recordMutation({
      tenantId: principal.tenantId,
      actorId: principal.userId,
      action: 'FILE_OBJECT_APPROVED',
      entityId: fileObject.id,
      oldValue: { status: oldStatus },
      newValue: { status: fileObject.status }
    });

    return this.mapToResponse(fileObject);
  }

  public async deleteFileObject(principal: Principal, id: string): Promise<boolean> {
    if (!principal || !principal.tenantId) {
      throw new Error('Unauthorized: Tenant context required.');
    }
    if (!principal.permissions.includes('file:delete') && !principal.roles.includes('admin')) {
      throw new Error('Forbidden: Insufficient permissions to delete file object.');
    }

    const existing = await this.repository.findById(id, principal.tenantId);
    if (!existing) {
      throw new Error(`FileObject with ID '${id}' not found.`);
    }

    const deleted = await this.repository.delete(id, principal.tenantId);

    if (deleted) {
      await this.auditService.recordMutation({
        tenantId: principal.tenantId,
        actorId: principal.userId,
        action: 'FILE_OBJECT_DELETED',
        entityId: id,
        oldValue: { status: existing.status }
      });
    }

    return deleted;
  }

  private mapToResponse(fileObject: FileObjectAggregate): FileObjectResponseDto {
    return {
      id: fileObject.id,
      tenantId: fileObject.tenantId,
      filename: fileObject.filename,
      mimeType: fileObject.mimeType,
      sizeBytes: fileObject.sizeBytes,
      storagePath: fileObject.storagePath,
      checksum: fileObject.checksum,
      status: fileObject.status,
      version: fileObject.version,
      createdAt: fileObject.createdAt.toISOString(),
      updatedAt: fileObject.updatedAt.toISOString()
    };
  }
}
