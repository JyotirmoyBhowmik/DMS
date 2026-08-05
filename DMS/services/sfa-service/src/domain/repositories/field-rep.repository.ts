import { FieldRep } from '../entities/field-rep.js';

export interface FieldRepRepository {
  save(fieldRep: FieldRep, tenantId: string): Promise<FieldRep>;
  findById(id: string, tenantId: string): Promise<FieldRep | null>;
  findByEmployeeCode(employeeCode: string, tenantId: string): Promise<FieldRep | null>;
  findByUserId(userId: string, tenantId: string): Promise<FieldRep | null>;
  findAll(tenantId: string, limit?: number, offset?: number, filters?: {
    status?: string;
    employeeCode?: string;
    search?: string;
  }): Promise<FieldRep[]>;
  delete(id: string, tenantId: string): Promise<void>;
  count(tenantId: string, filters?: {
    status?: string;
    employeeCode?: string;
    search?: string;
  }): Promise<number>;
}
