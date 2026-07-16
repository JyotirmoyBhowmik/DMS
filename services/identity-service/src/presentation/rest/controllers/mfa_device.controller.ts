import { loadConfigSync } from '@dms/pkg-config';
import { PostgresDatabaseClient, PgDriver } from '@dms/pkg-database';
import { CreateMFADeviceUseCase, GetMFADeviceUseCase, UpdateMFADeviceUseCase, DeleteMFADeviceUseCase, ListMFADevicesUseCase } from '../../../application/usecases/mfa_device.usecases.js';
import { MFADevicePgRepository } from '../../../infrastructure/database/repositories/mfa_device.pg-repository.js';
import { HttpResponse } from './auth.controller.js';

const config = loadConfigSync();

export class MFADeviceController {
  private db = new PostgresDatabaseClient(config.db, new PgDriver());
  private mfaRepo = new MFADevicePgRepository(this.db);
  private createMFADeviceUseCase = new CreateMFADeviceUseCase(this.db, this.mfaRepo);
  private getMFADeviceUseCase = new GetMFADeviceUseCase(this.mfaRepo);
  private updateMFADeviceUseCase = new UpdateMFADeviceUseCase(this.db, this.mfaRepo);
  private deleteMFADeviceUseCase = new DeleteMFADeviceUseCase(this.mfaRepo);
  private listMFADevicesUseCase = new ListMFADevicesUseCase(this.mfaRepo);

  async handlePostMFADevice(requestBody: any, headers: Record<string, string>): Promise<HttpResponse> {
    const tenantId = headers['x-tenant-id'] || 'mock-tenant';
    try {
      const mfaDevice = await this.createMFADeviceUseCase.execute(tenantId, requestBody);
      return {
        statusCode: 201,
        body: mfaDevice as any,
      };
    } catch (err: any) {
      return {
        statusCode: 400,
        body: { message: err.message },
      };
    }
  }

  async handleGetMFADevice(id: string, headers: Record<string, string>): Promise<HttpResponse> {
    const tenantId = headers['x-tenant-id'] || 'mock-tenant';
    try {
      const mfaDevice = await this.getMFADeviceUseCase.execute(id, tenantId);
      return {
        statusCode: 200,
        body: mfaDevice as any,
      };
    } catch (err: any) {
      return {
        statusCode: 404,
        body: { message: err.message },
      };
    }
  }

  async handlePutMFADevice(id: string, requestBody: any, headers: Record<string, string>): Promise<HttpResponse> {
    const tenantId = headers['x-tenant-id'] || 'mock-tenant';
    try {
      const mfaDevice = await this.updateMFADeviceUseCase.execute(tenantId, { ...requestBody, id });
      return {
        statusCode: 200,
        body: mfaDevice as any,
      };
    } catch (err: any) {
      return {
        statusCode: 400,
        body: { message: err.message },
      };
    }
  }

  async handleDeleteMFADevice(id: string, headers: Record<string, string>): Promise<HttpResponse> {
    const tenantId = headers['x-tenant-id'] || 'mock-tenant';
    try {
      const success = await this.deleteMFADeviceUseCase.execute(id, tenantId);
      return {
        statusCode: success ? 200 : 404,
        body: { success },
      };
    } catch (err: any) {
      return {
        statusCode: 400,
        body: { message: err.message },
      };
    }
  }

  async handleListMFADevices(requestBody: any, headers: Record<string, string>): Promise<HttpResponse> {
    const tenantId = headers['x-tenant-id'] || 'mock-tenant';
    try {
      const result = await this.listMFADevicesUseCase.execute(tenantId, requestBody);
      return {
        statusCode: 200,
        body: result as any,
      };
    } catch (err: any) {
      return {
        statusCode: 400,
        body: { message: err.message },
      };
    }
  }
}
