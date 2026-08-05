import { BaseEntityModel } from '@dms/pkg-database';

export class Tenant extends BaseEntityModel {
  name!: string;
  status!: string;
}
