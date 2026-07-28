import { FileObjectAggregate } from '../../domain/entities/file_object.entity.js';
import { FileObjectRepository } from '../../domain/repositories/file_object.repository.js';
import { FileObjectResponseDto, ListFileObjectsQueryDto } from '../dtos/file_object.dto.js';
import { Principal } from './create-file-object.usecase.js';

export interface PaginatedFileObjectsResponseDto {
  fileObjects: FileObjectResponseDto[];
  total: number;
  page: number;
  pageSize: number;
}

export class ListFileObjectsUseCase {
  constructor(private readonly repository: FileObjectRepository) {}

  public async execute(principal: Principal, query: ListFileObjectsQueryDto): Promise<PaginatedFileObjectsResponseDto> {
    if (!principal || !principal.tenantId) {
      throw new Error('Unauthorized: Tenant context required.');
    }
    if (!principal.permissions.includes('file:read') && !principal.roles.includes('admin')) {
      throw new Error('Forbidden: Insufficient permissions to list file objects.');
    }

    const result = await this.repository.findAll({
      tenantId: principal.tenantId,
      filename: query.filename,
      mimeType: query.mimeType,
      status: query.status,
      page: query.page ?? 1,
      pageSize: query.pageSize ?? 20
    });

    return {
      fileObjects: result.fileObjects.map(f => this.mapToResponse(f)),
      total: result.total,
      page: result.page,
      pageSize: result.pageSize
    };
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
