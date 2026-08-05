import { UserStatus } from '../../domain/entities/user.entity.js';

export interface CreateUserDto {
  email: string;
  passwordHash: string;
  firstName?: string;
  lastName?: string;
  roles?: string[];
  idempotencyKey?: string;
}

export interface UpdateUserDto {
  status?: UserStatus;
  roles?: string[];
  firstName?: string;
  lastName?: string;
  version: number;
}

export interface UserResponseDto {
  id: string;
  tenantId: string;
  email: string;
  firstName?: string;
  lastName?: string;
  roles: string[];
  status: UserStatus;
  idempotencyKey?: string;
  version: number;
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string;
}
