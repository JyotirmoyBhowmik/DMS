import { randomUUID } from 'node:crypto';
import { FileObjectAggregate } from '../../domain/entities/file_object.entity.js';
import { FileObjectRepository } from '../../domain/repositories/file_object.repository.js';
import { sanitizeFilename, validateCreateFileObjectInput } from '../../domain/validation/file_object.validation.js';
import { FileObjectAuditService } from '../../infrastructure/audit/file_object.audit.js';
import { CreateFileObjectDto, FileObjectResponseDto } from '../dtos/file_object.dto.js';

export interface Principal {
  userId: string;
  tenantId: string;
  roles: string[];
  permissions: string[];
}

export class CreateFileObjectUseCase {
  private static processedKeys: Set<string> = new Set<string>();

  constructor(
    private readonly repository: FileObjectRepository,
    private readonly auditService: FileObjectAuditService = new FileObjectAuditService()
  ) {}

  public async execute(principal: Principal, dto: CreateFileObjectDto): Promise<FileObjectResponseDto> {
    if (!principal || !principal.tenantId) {
      throw new Error('Unauthorized: Tenant context required.');
    }
    if (!principal.permissions.includes('file:create') && !principal.roles.includes('admin')) {
      throw new Error('Forbidden: Insufficient permissions to create file object.');
    }

    validateCreateFileObjectInput(dto);

    if (dto.idempotencyKey) {
      const key = `${principal.tenantId}:${dto.idempotencyKey}`;
      if (CreateFileObjectUseCase.processedKeys.has(key)) {
        throw new Error(`Duplicate request: Idempotency key '${dto.idempotencyKey}' already processed.`);
      }
      CreateFileObjectUseCase.processedKeys.add(key);
    }

    const cleanFilename = sanitizeFilename(dto.filename);
    const fileId = dto.id ?? randomUUID();

    const fileObject = FileObjectAggregate.create({
      id: fileId,
      tenantId: principal.tenantId,
      filename: cleanFilename,
      mimeType: dto.mimeType,
      sizeBytes: dto.sizeBytes,
      storagePath: dto.storagePath,
      checksum: dto.checksum
    });

    await this.repository.save(fileObject);

    await this.auditService.recordMutation({
      tenantId: principal.tenantId,
      actorId: principal.userId,
      action: 'FILE_OBJECT_CREATED',
      entityId: fileObject.id,
      newValue: { filename: fileObject.filename, status: fileObject.status }
    });

    return this.mapToResponse(fileObject);
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
