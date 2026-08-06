const fs = require('fs');
const path = require('path');

module.paths.push('c:/Users/TEST/DMS/services/api-gateway/node_modules');
module.paths.push('c:/Users/TEST/DMS/packages/pkg-database/node_modules');
module.paths.push('c:/Users/TEST/DMS/node_modules');

function resolveConnectionString() {
  const envUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.NEON_DATABASE_URL;
  if (envUrl && envUrl.trim().length > 0) {
    let url = envUrl.trim();
    if (!url.includes('sslmode=')) {
      url += (url.includes('?') ? '&' : '?') + 'sslmode=require';
    }
    return url;
  }

  const dbHost = process.env.DB_HOST;
  const dbPort = process.env.DB_PORT || '5432';
  const dbUser = process.env.DB_USER;
  const dbPassword = process.env.DB_PASSWORD;
  const dbName = process.env.DB_NAME || 'neondb';

  if (dbHost && dbUser && dbPassword) {
    return `postgres://${encodeURIComponent(dbUser)}:${encodeURIComponent(dbPassword)}@${dbHost}:${dbPort}/${dbName}?sslmode=require`;
  }

  return null;
}

async function runNeonMigrationRunner() {
  console.log('======================================================');
  console.log('NEON POSTGRES DATABASE MIGRATION RUNNER:');
  console.log('======================================================');

  const connStr = resolveConnectionString();
  if (!connStr) {
    console.log('⚠️ DATABASE_URL environment variable is not configured.');
    console.log('Standby Offline Mode: SQL migration files are generated in db/migrations/ as the authoritative source of truth.\n');
    console.log('Source of Truth Migration File: db/migrations/0007_tenants_distributors_agents.sql');
    console.log('✅ Migration Runner standby check complete.');
    return;
  }

  let pool;
  if (connStr.includes('neon.tech')) {
    const { Pool } = require('@neondatabase/serverless');
    pool = new Pool({ connectionString: connStr });
  } else {
    const { Pool } = require('pg');
    pool = new Pool({ connectionString: connStr });
  }

  try {
    console.log('Connecting to Neon Postgres database...');

    // 1. Create schema_migrations tracking table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name VARCHAR(255) PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // 2. Discover Migration Files
    const migrationsDir = path.join(__dirname, '..', 'db', 'migrations');
    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();

    console.log(`Found ${files.length} SQL migration file(s) in db/migrations/`);

    // 3. Fetch Already Executed Migrations
    const executedRes = await pool.query('SELECT name FROM schema_migrations');
    const executed = new Set(executedRes.rows.map(r => r.name));

    // 4. Sequentially Apply Unapplied Migrations
    let countApplied = 0;
    for (const file of files) {
      if (executed.has(file)) {
        console.log(`- Skipping ${file} (Already Applied)`);
        continue;
      }

      console.log(`⚡ Applying Migration: ${file}...`);
      const filePath = path.join(migrationsDir, file);
      const sqlContent = fs.readFileSync(filePath, 'utf-8');

      await pool.query('BEGIN');
      try {
        await pool.query(sqlContent);
        await pool.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
        await pool.query('COMMIT');
        console.log(`  ✓ Successfully Applied ${file}`);
        countApplied++;
      } catch (sqlErr) {
        await pool.query('ROLLBACK');
        throw new Error(`Failed to apply migration ${file}: ${sqlErr.message}`);
      }
    }

    await pool.end();
    console.log(`\n======================================================`);
    console.log(`✅ NEON DATABASE MIGRATION COMPLETED! (${countApplied} new migration(s) applied)`);
    console.log(`======================================================`);
  } catch (err) {
    if (pool) await pool.end().catch(() => {});
    console.error('❌ Neon Migration Runner Error:', err.message);
    process.exit(1);
  }
}

runNeonMigrationRunner().catch(console.error);
