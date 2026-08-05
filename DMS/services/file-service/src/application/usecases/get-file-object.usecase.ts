import { FileObjectAggregate } from '../../domain/entities/file_object.entity.js';
import { FileObjectRepository } from '../../domain/repositories/file_object.repository.js';
import { FileObjectResponseDto } from '../dtos/file_object.dto.js';
import { Principal } from './create-file-object.usecase.js';

export class GetFileObjectUseCase {
  constructor(private readonly repository: FileObjectRepository) {}

  public async execute(principal: Principal, id: string): Promise<FileObjectResponseDto> {
    if (!principal || !principal.tenantId) {
      throw new Error('Unauthorized: Tenant context required.');
    }
    if (!principal.permissions.includes('file:read') && !principal.roles.includes('admin')) {
      throw new Error('Forbidden: Insufficient permissions to view file object.');
    }
    if (!id || id.trim().length === 0) {
      throw new Error('FileObject ID is required.');
    }

    const fileObject = await this.repository.findById(id, principal.tenantId);
    if (!fileObject) {
      throw new Error(`FileObject with ID '${id}' not found.`);
    }

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
