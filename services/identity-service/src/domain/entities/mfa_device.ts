import { BaseEntityModel, Tenant, Encrypted } from '@dms/pkg-database';

export class MFADevice extends BaseEntityModel {
  @Tenant()
  declare tenantId: string;

  version!: number;

  userId!: string;
  type!: string;

  @Encrypted()
  secretEncrypted!: string;

  isActive!: boolean;
  lastUsedAt!: Date | null;
}
