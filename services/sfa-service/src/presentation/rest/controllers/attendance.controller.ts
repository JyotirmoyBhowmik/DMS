import { AttendancePgRepository } from '../../../infrastructure/database/repositories/attendance.pg-repository.js';
import { CreateAttendanceUseCase } from '../../../application/usecases/attendance/create_attendance.usecase.js';
import { GetAttendanceUseCase } from '../../../application/usecases/attendance/get_attendance.usecase.js';
import { UpdateAttendanceUseCase } from '../../../application/usecases/attendance/update_attendance.usecase.js';
import { ListAttendancesUseCase } from '../../../application/usecases/attendance/list_attendances.usecase.js';
import { CreateAttendanceSchema, UpdateAttendanceSchema } from '@dms/pkg-validation';
import { PostgresDatabaseClient, PgDriver } from '@dms/pkg-database';
import { StructuredLogger } from '@dms/pkg-logger';
import { loadConfigSync } from '@dms/pkg-config';

const config = loadConfigSync();

export class AttendanceController {
  private db = new PostgresDatabaseClient(config.db, new PgDriver());
  private repo = new AttendancePgRepository(this.db);
  private createUseCase = new CreateAttendanceUseCase(this.db, this.repo);
  private getUseCase = new GetAttendanceUseCase(this.db, this.repo);
  private updateUseCase = new UpdateAttendanceUseCase(this.db, this.repo);
  private listUseCase = new ListAttendancesUseCase(this.db, this.repo);
  private logger = new StructuredLogger('AttendanceController');

  static clearStore(): void {
    AttendancePgRepository.clearStore();
  }

  async handlePostAttendance(requestBody: any, headers: Record<string, string>): Promise<any> {
    const tenantId = headers['x-tenant-id'] || 'mock-tenant';
    this.logger.info('Received HTTP POST attendance request', { tenantId });

    const validationResult = CreateAttendanceSchema.safeParse(requestBody);
    if (!validationResult.success) {
      this.logger.warn('Validation failed for create attendance', { errors: validationResult.error.errors });
      return {
        statusCode: 400,
        body: {
          message: 'Bad Request',
          errors: validationResult.error.errors,
        },
      };
    }

    try {
      const result = await this.createUseCase.execute(tenantId, validationResult.data);
      return {
        statusCode: 201,
        body: {
          success: true,
          attendanceId: result.attendanceId,
          status: result.status,
        },
      };
    } catch (err: any) {
      this.logger.error('Failed to create attendance', { error: err.message });
      if (err.message.includes('already exists')) {
        return {
          statusCode: 409,
          body: {
            success: false,
            message: err.message,
          },
        };
      }
      return {
        statusCode: 500,
        body: {
          message: err.message || 'Internal Server Error',
        },
      };
    }
  }

  async handlePutAttendance(id: string, requestBody: any, headers: Record<string, string>): Promise<any> {
    const tenantId = headers['x-tenant-id'] || 'mock-tenant';
    this.logger.info('Received HTTP PUT attendance request', { id, tenantId });

    const validationResult = UpdateAttendanceSchema.safeParse(requestBody);
    if (!validationResult.success) {
      return {
        statusCode: 400,
        body: {
          message: 'Bad Request',
          errors: validationResult.error.errors,
        },
      };
    }

    try {
      const result = await this.updateUseCase.execute(tenantId, id, validationResult.data);
      return {
        statusCode: 200,
        body: {
          success: true,
          attendanceId: result.attendanceId,
          status: result.status,
        },
      };
    } catch (err: any) {
      this.logger.error('Failed to update attendance', { error: err.message });
      return {
        statusCode: err.message.includes('not found') ? 404 : 500,
        body: {
          message: err.message || 'Internal Server Error',
        },
      };
    }
  }

  async handleGetAttendance(id: string, headers: Record<string, string>): Promise<any> {
    const tenantId = headers['x-tenant-id'] || 'mock-tenant';
    this.logger.info('Received HTTP GET attendance request', { id, tenantId });

    try {
      const attendance = await this.getUseCase.execute(tenantId, id);
      return {
        statusCode: 200,
        body: {
          success: true,
          attendance: attendance.toJSON(),
        },
      };
    } catch (err: any) {
      this.logger.error('Failed to get attendance', { error: err.message });
      return {
        statusCode: err.message.includes('not found') ? 404 : 500,
        body: {
          message: err.message || 'Internal Server Error',
        },
      };
    }
  }

  async handleListAttendances(requestBody: any, headers: Record<string, string>): Promise<any> {
    const tenantId = headers['x-tenant-id'] || 'mock-tenant';
    this.logger.info('Received HTTP GET attendances list request', { tenantId });

    try {
      const result = await this.listUseCase.execute(tenantId, requestBody || {});
      return {
        statusCode: 200,
        body: {
          success: true,
          data: result.data.map(a => a.toJSON()),
          page: result.page,
          pageSize: result.pageSize,
        },
      };
    } catch (err: any) {
      this.logger.error('Failed to list attendances', { error: err.message });
      return {
        statusCode: 500,
        body: {
          message: err.message || 'Internal Server Error',
        },
      };
    }
  }
}
