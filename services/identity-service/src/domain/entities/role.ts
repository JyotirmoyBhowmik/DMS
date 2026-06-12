import { BaseEntityModel, Tenant } from '@dms/pkg-database';

export class Role extends BaseEntityModel {
  @Tenant()
  declare tenantId: string;

  version!: number;

  name!: string;
  description!: string | null;
  isSystem!: boolean;
}
