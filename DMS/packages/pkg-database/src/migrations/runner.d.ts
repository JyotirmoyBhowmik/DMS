import { PostgresDatabaseClient } from '../postgres/client.js';
export interface MigrationInfo {
    /** e.g. "V002" */
    version: string;
    /** e.g. "create_migration_tracking" */
    description: string;
    /** Full filename, e.g. "V002__create_migration_tracking.sql" */
    filename: string;
    /** Absolute path to the SQL file */
    filepath: string;
}
export interface AppliedMigration {
    version: string;
    description: string;
    filename: string;
    checksum: string;
    appliedAt: Date;
    executionTimeMs: number;
}
export interface MigrationStatus {
    applied: AppliedMigration[];
    pending: MigrationInfo[];
    current: string | null;
}
export interface MigrationValidation {
    valid: boolean;
    errors: string[];
    warnings: string[];
}
export interface MigrationRunnerConfig {
    /** Absolute path to the directory containing SQL migration files */
    migrationsDir: string;
    /** Schema name under which the schema_migrations table lives. Default: "public" */
    schema?: string;
    /** Table name for tracking applied migrations. Default: "schema_migrations" */
    tableName?: string;
}
export declare class MigrationRunner {
    private readonly db;
    private readonly migrationsDir;
    private readonly schema;
    private readonly tableName;
    private readonly fqTable;
    constructor(db: PostgresDatabaseClient, config: MigrationRunnerConfig);
    /**
     * Run all pending migrations in version order.
     * Returns the list of newly applied migrations.
     */
    migrate(): Promise<AppliedMigration[]>;
    /**
     * Rollback the last `steps` applied migrations (most-recent first).
     *
     * The runner looks for a matching `*.down.sql` file alongside the original
     * migration.  If no down file exists the rollback for that step is skipped
     * with a warning.
     */
    rollback(steps?: number): Promise<{
        rolledBack: string[];
        warnings: string[];
    }>;
    /**
     * Return the current migration status: which migrations are applied,
     * which are pending, and the current version.
     */
    status(): Promise<MigrationStatus>;
    /**
     * Validate migrations for CI gate checks:
     * - All filenames follow naming convention
     * - No gaps in version numbering
     * - Checksums of applied migrations haven't changed (tamper detection)
     * - No duplicate versions
     */
    validate(): Promise<MigrationValidation>;
    /**
     * Discover migration files in the configured directory.
     */
    private discoverMigrations;
    /**
     * Ensure the schema_migrations tracking table exists.
     */
    private ensureTrackingTable;
}
//# sourceMappingURL=runner.d.ts.map