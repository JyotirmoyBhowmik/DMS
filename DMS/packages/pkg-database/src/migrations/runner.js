"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MigrationRunner = void 0;
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
// ─── Helpers ──────────────────────────────────────────────────────────────────
const MIGRATION_FILENAME_RE = /^V(\d+)__(.+)\.(sql)$/;
function parseMigrationFilename(filename) {
    const match = MIGRATION_FILENAME_RE.exec(filename);
    if (!match)
        return null;
    return {
        version: `V${match[1]}`,
        description: match[2].replace(/_/g, ' '),
    };
}
/**
 * Simple checksum: sum of char codes (deterministic, fast, good enough for
 * detecting file tampering between environments).
 */
function computeChecksum(content) {
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
        const ch = content.charCodeAt(i);
        hash = ((hash << 5) - hash + ch) | 0;
    }
    return Math.abs(hash).toString(16).padStart(8, '0');
}
// ─── Migration Runner ─────────────────────────────────────────────────────────
class MigrationRunner {
    db;
    migrationsDir;
    schema;
    tableName;
    fqTable;
    constructor(db, config) {
        this.db = db;
        this.migrationsDir = config.migrationsDir;
        this.schema = config.schema ?? 'public';
        this.tableName = config.tableName ?? 'schema_migrations';
        this.fqTable = `"${this.schema}"."${this.tableName}"`;
    }
    // ── Public API ──────────────────────────────────────────────────────────
    /**
     * Run all pending migrations in version order.
     * Returns the list of newly applied migrations.
     */
    async migrate() {
        await this.ensureTrackingTable();
        const pending = (await this.status()).pending;
        if (pending.length === 0)
            return [];
        const applied = [];
        for (const migration of pending) {
            const sql = (0, node_fs_1.readFileSync)(migration.filepath, 'utf-8');
            const checksum = computeChecksum(sql);
            const start = Date.now();
            await this.db.transaction(async (conn) => {
                // Execute the migration SQL
                await conn.query(sql);
                // Record it in the tracking table
                await conn.query(`INSERT INTO ${this.fqTable}
             (version, description, filename, checksum, applied_at, execution_time_ms)
           VALUES ($1, $2, $3, $4, NOW(), $5)`, [
                    migration.version,
                    migration.description,
                    migration.filename,
                    checksum,
                    Date.now() - start,
                ]);
            });
            applied.push({
                version: migration.version,
                description: migration.description,
                filename: migration.filename,
                checksum,
                appliedAt: new Date(),
                executionTimeMs: Date.now() - start,
            });
        }
        return applied;
    }
    /**
     * Rollback the last `steps` applied migrations (most-recent first).
     *
     * The runner looks for a matching `*.down.sql` file alongside the original
     * migration.  If no down file exists the rollback for that step is skipped
     * with a warning.
     */
    async rollback(steps = 1) {
        await this.ensureTrackingTable();
        const { applied } = await this.status();
        const warnings = [];
        const rolledBack = [];
        // Most recent first
        const toRollback = applied
            .sort((a, b) => (b.version > a.version ? 1 : -1))
            .slice(0, steps);
        for (const migration of toRollback) {
            const downFile = migration.filename.replace(/\.sql$/, '.down.sql');
            const downPath = (0, node_path_1.join)(this.migrationsDir, downFile);
            if (!(0, node_fs_1.existsSync)(downPath)) {
                warnings.push(`No rollback file found for ${migration.filename} (expected ${downFile})`);
                continue;
            }
            const sql = (0, node_fs_1.readFileSync)(downPath, 'utf-8');
            await this.db.transaction(async (conn) => {
                await conn.query(sql);
                await conn.query(`DELETE FROM ${this.fqTable} WHERE version = $1`, [migration.version]);
            });
            rolledBack.push(migration.version);
        }
        return { rolledBack, warnings };
    }
    /**
     * Return the current migration status: which migrations are applied,
     * which are pending, and the current version.
     */
    async status() {
        await this.ensureTrackingTable();
        const result = await this.db.query(`SELECT version, description, filename, checksum, applied_at, execution_time_ms
        FROM ${this.fqTable}
        ORDER BY version ASC`);
        const applied = result.rows.map((r) => ({
            version: r.version,
            description: r.description,
            filename: r.filename,
            checksum: r.checksum,
            appliedAt: r.applied_at,
            executionTimeMs: r.execution_time_ms,
        }));
        const appliedVersions = new Set(applied.map((a) => a.version));
        const allMigrations = this.discoverMigrations();
        const pending = allMigrations.filter((m) => !appliedVersions.has(m.version));
        return {
            applied,
            pending,
            current: applied.length > 0 ? applied[applied.length - 1].version : null,
        };
    }
    /**
     * Validate migrations for CI gate checks:
     * - All filenames follow naming convention
     * - No gaps in version numbering
     * - Checksums of applied migrations haven't changed (tamper detection)
     * - No duplicate versions
     */
    async validate() {
        const errors = [];
        const warnings = [];
        // 1. Discover files
        const migrations = this.discoverMigrations();
        if (migrations.length === 0) {
            warnings.push('No migration files found in directory');
            return { valid: true, errors, warnings };
        }
        // 2. Check for duplicate versions
        const versionCounts = new Map();
        for (const m of migrations) {
            versionCounts.set(m.version, (versionCounts.get(m.version) ?? 0) + 1);
        }
        for (const [version, count] of versionCounts) {
            if (count > 1) {
                errors.push(`Duplicate migration version: ${version} (found ${count} files)`);
            }
        }
        // 3. Check for version gaps
        const versionNumbers = migrations
            .map((m) => parseInt(m.version.slice(1), 10))
            .sort((a, b) => a - b);
        for (let i = 1; i < versionNumbers.length; i++) {
            const prev = versionNumbers[i - 1];
            const curr = versionNumbers[i];
            if (curr - prev > 1) {
                warnings.push(`Gap in version numbering between V${String(prev).padStart(3, '0')} and V${String(curr).padStart(3, '0')}`);
            }
        }
        // 4. Tamper detection: compare checksums of applied migrations
        try {
            await this.ensureTrackingTable();
            const { applied } = await this.status();
            for (const appliedMig of applied) {
                const diskMig = migrations.find((m) => m.version === appliedMig.version);
                if (!diskMig) {
                    errors.push(`Applied migration ${appliedMig.version} (${appliedMig.filename}) not found on disk`);
                    continue;
                }
                const content = (0, node_fs_1.readFileSync)(diskMig.filepath, 'utf-8');
                const diskChecksum = computeChecksum(content);
                if (diskChecksum !== appliedMig.checksum) {
                    errors.push(`Checksum mismatch for ${appliedMig.version}: applied=${appliedMig.checksum}, disk=${diskChecksum}. ` +
                        'Migration files must not be modified after they are applied.');
                }
            }
        }
        catch {
            // If the tracking table doesn't exist yet, skip tamper check
            warnings.push('Could not verify checksums – tracking table may not exist yet');
        }
        return {
            valid: errors.length === 0,
            errors,
            warnings,
        };
    }
    // ── Private helpers ───────────────────────────────────────────────────────
    /**
     * Discover migration files in the configured directory.
     */
    discoverMigrations() {
        if (!(0, node_fs_1.existsSync)(this.migrationsDir))
            return [];
        return (0, node_fs_1.readdirSync)(this.migrationsDir)
            .filter((f) => MIGRATION_FILENAME_RE.test(f))
            .map((filename) => {
            const parsed = parseMigrationFilename(filename);
            return {
                version: parsed.version,
                description: parsed.description,
                filename,
                filepath: (0, node_path_1.join)(this.migrationsDir, filename),
            };
        })
            .sort((a, b) => (a.version > b.version ? 1 : -1));
    }
    /**
     * Ensure the schema_migrations tracking table exists.
     */
    async ensureTrackingTable() {
        await this.db.query(`
      CREATE TABLE IF NOT EXISTS ${this.fqTable} (
        version           VARCHAR(20)   PRIMARY KEY,
        description       TEXT          NOT NULL,
        filename          VARCHAR(255)  NOT NULL,
        checksum          VARCHAR(16)   NOT NULL,
        applied_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
        execution_time_ms INTEGER       NOT NULL DEFAULT 0
      )
    `);
    }
}
exports.MigrationRunner = MigrationRunner;
//# sourceMappingURL=runner.js.map