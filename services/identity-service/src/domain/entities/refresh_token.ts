import { BaseEntityModel, Tenant } from '@dms/pkg-database';

export class RefreshToken extends BaseEntityModel {
  @Tenant()
  declare tenantId: string;

  token!: string;
  userId!: string;
  familyId!: string;
  isUsed!: boolean;
  expiresAt!: Date;
}
