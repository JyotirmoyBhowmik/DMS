// Annotations
export { PII, isPII, getPIIFields } from './annotations/pii.js';
export { Encrypted, isEncrypted, getEncryptedFields, packEncrypted, unpackEncrypted, createEncryptedTransformer } from './annotations/encrypted.js';
export { Tenant, isTenantColumn, getTenantField } from './annotations/tenant.js';

// RLS
export { buildTenantRlsPolicy, setTenantContext, clearTenantContext, RlsPolicyBuilder } from './rls/policy_builder.js';

// Models
export { BaseEntityModel } from './models/base.entity.js';
export type { BaseEntity } from './models/base.entity.js';

export { OutboxEntryModel } from './models/outbox.entity.js';
export type { OutboxEntry } from './models/outbox.entity.js';

export { ProcessedEventModel } from './models/processed-event.entity.js';
export type { ProcessedEvent } from './models/processed-event.entity.js';

// Unit of Work
export { InMemoryUnitOfWork } from './unit-of-work/uow.js';
export type { Transaction, UnitOfWork } from './unit-of-work/uow.js';

// Postgres Client Pool
export { PostgresDatabaseClient, InMemoryDriver, PgDriver } from './postgres/client.js';
export type { DatabaseConfig, IDatabaseDriver, IConnectionClient, QueryResult, PoolMetrics } from './postgres/client.js';

// Repositories
export { BasePostgresRepository } from './repositories/base.repository.js';
export type { BaseRow, FindAllOptions, PaginationOptions, PaginatedResult } from './repositories/base.repository.js';

// Migrations
export { MigrationRunner } from './migrations/runner.js';

// Errors
export { DatabaseError, EntityNotFoundError, ConcurrencyError } from './errors.js';


