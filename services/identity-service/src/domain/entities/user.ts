import { BaseEntityModel, Tenant, PII } from '@dms/pkg-database';

export class User extends BaseEntityModel {
  @Tenant()
  declare tenantId: string;

  version!: number;

  @PII()
  email!: string;

  passwordHash!: string;
  status!: string;
  lastLoginAt!: Date | null;
}
