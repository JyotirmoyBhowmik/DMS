import { BaseEntityModel } from '@dms/pkg-database';

export class Permission extends BaseEntityModel {
  name!: string;
  resource!: string;
  action!: string;
  description!: string | null;
}
