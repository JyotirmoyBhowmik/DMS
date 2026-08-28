import { CreateMFADeviceUseCase } from '../../../application/usecases/create-mfa-device.usecase.js';
import { GetMFADeviceUseCase } from '../../../application/usecases/get-mfa-device.usecase.js';
import { UpdateMFADeviceUseCase } from '../../../application/usecases/update-mfa-device.usecase.js';
import { ListMFADevicesUseCase } from '../../../application/usecases/list-mfa-devices.usecase.js';
import {
  MFADeviceDomainError,
  MFADeviceValidationError,
} from '../../../domain/entities/mfa_device.entity.js';
import { MFADevicePgRepository } from '../../../infrastructure/database/repositories/mfa_device.pg-repository.js';
import { Principal } from '../../../application/usecases/create-user.usecase.js';

export class MFADeviceController {
  private createUseCase: CreateMFADeviceUseCase;
  private getUseCase: GetMFADeviceUseCase;
  private updateUseCase: UpdateMFADeviceUseCase;
  private listUseCase: ListMFADevicesUseCase;
  private repo: MFADevicePgRepository;

  constructor(
    createUseCase?: CreateMFADeviceUseCase,
    getUseCase?: GetMFADeviceUseCase,
    updateUseCase?: UpdateMFADeviceUseCase,
    listUseCase?: ListMFADevicesUseCase,
    repo?: MFADevicePgRepository,
  ) {
    this.repo = repo || new MFADevicePgRepository();
    this.createUseCase = createUseCase || new CreateMFADeviceUseCase(this.repo);
    this.getUseCase = getUseCase || new GetMFADeviceUseCase(this.repo);
    this.updateUseCase = updateUseCase || new UpdateMFADeviceUseCase(this.repo);
    this.listUseCase = listUseCase || new ListMFADevicesUseCase(this.repo);
  }

  async handlePostMFADevice(body: any, headers?: any): Promise<{ statusCode: number; body: any }> {
    try {
      const contentType = headers && (headers['content-type'] || headers['Content-Type']);
      if (contentType && !contentType.includes('application/json')) {
        return {
          statusCode: 415,
          body: {
            success: false,
            error: { message: 'Unsupported Media Type: Content-Type must be application/json' },
          },
        };
      }

      const principal = this.extractPrincipalFromHeaders(headers);
      const idempotencyKey = headers && headers['x-idempotency-key'];
      const result = await this.createUseCase.execute(principal, body, idempotencyKey);
      return { statusCode: 201, body: result.toJSON() };
    } catch (err: any) {
      return this.mapError(err);
    }
  }

  async handleGetMFADevice(id: string, headers?: any): Promise<{ statusCode: number; body: any }> {
    try {
      const principal = this.extractPrincipalFromHeaders(headers);
      const result = await this.getUseCase.execute(id, principal);
      return { statusCode: 200, body: result.toJSON() };
    } catch (err: any) {
      return this.mapError(err);
    }
  }

  async handleListMFADevices(
    query?: any,
    headers?: any,
  ): Promise<{ statusCode: number; body: any }> {
    try {
      const principal = this.extractPrincipalFromHeaders(headers);
      const options = {
        page: query?.page ? parseInt(query.page, 10) : 1,
        limit: query?.limit ? parseInt(query.limit, 10) : 20,
        type: query?.type,
        isActive: query?.isActive !== undefined ? query.isActive === 'true' : undefined,
        userId: query?.userId,
      };
      const result = await this.listUseCase.execute(principal, options);
      return {
        statusCode: 200,
        body: {
          items: result.items.map((item) => item.toJSON()),
          total: result.total,
          page: options.page,
          limit: options.limit,
        },
      };
    } catch (err: any) {
      return this.mapError(err);
    }
  }

  async handlePutMFADevice(
    id: string,
    body: any,
    headers?: any,
  ): Promise<{ statusCode: number; body: any }> {
    try {
      const contentType = headers && (headers['content-type'] || headers['Content-Type']);
      if (contentType && !contentType.includes('application/json')) {
        return {
          statusCode: 415,
          body: {
            success: false,
            error: { message: 'Unsupported Media Type: Content-Type must be application/json' },
          },
        };
      }

      const principal = this.extractPrincipalFromHeaders(headers);
      const result = await this.updateUseCase.execute(id, principal, body);
      return { statusCode: 200, body: result.toJSON() };
    } catch (err: any) {
      return this.mapError(err);
    }
  }

  async handleDeleteMFADevice(
    id: string,
    headers?: any,
  ): Promise<{ statusCode: number; body: any }> {
    try {
      const tenantId =
        (headers && headers['x-tenant-id']) || '00000000-0000-0000-0000-000000000001';
      const deleted = await this.repo.delete(id, tenantId);
      return { statusCode: deleted ? 200 : 404, body: { success: deleted } };
    } catch (err: any) {
      return this.mapError(err);
    }
  }

  private extractPrincipalFromHeaders(headers: any): Principal {
    const tenantId = (headers && headers['x-tenant-id']) || '00000000-0000-0000-0000-000000000001';
    const userId = (headers && headers['x-user-id']) || 'user-default';
    const rolesStr = (headers && headers['x-user-roles']) || 'admin';
    const permsStr = (headers && headers['x-user-permissions']) || 'identity:*';

    return {
      userId,
      tenantId,
      roles: rolesStr.split(',').map((r: string) => r.trim()),
      permissions: permsStr.split(',').map((p: string) => p.trim()),
    };
  }

  private mapError(err: any): { statusCode: number; body: any } {
    if (err instanceof MFADeviceValidationError) {
      return {
        statusCode: 422,
        body: { success: false, error: { message: err.message, fields: err.fields } },
      };
    }

    if (err instanceof MFADeviceDomainError) {
      if (err.message.startsWith('Forbidden')) {
        return { statusCode: 403, body: { success: false, error: { message: err.message } } };
      }
      if (err.message.startsWith('Unauthorized')) {
        return { statusCode: 401, body: { success: false, error: { message: err.message } } };
      }
      if (err.message.includes('not found')) {
        return { statusCode: 404, body: { success: false, error: { message: err.message } } };
      }
      if (err.message.startsWith('Conflict') || err.message.includes('Optimistic concurrency')) {
        return { statusCode: 409, body: { success: false, error: { message: err.message } } };
      }
      return { statusCode: 400, body: { success: false, error: { message: err.message } } };
    }

    return {
      statusCode: 500,
      body: { success: false, error: { message: err.message || 'Internal Server Error' } },
    };
  }
}
