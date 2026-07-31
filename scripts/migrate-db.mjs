import fs from 'fs';
import path from 'path';
import pg from 'pg';

const { Client } = pg;

// Use CONNECTION_STRING env var or default to the user's Neon DB
const connectionString = process.env.DATABASE_URL || 
  process.env.CONNECTION_STRING || 
  "postgresql://neondb_owner:npg_2HQSygvRT5qZ@ep-falling-cloud-azy5iaz6-pooler.c-3.ap-southeast-1.aws.neon.tech/neondb?sslmode=require";

console.log('========================================================================');
console.log('⚡ DMS Automated Database Migration Runner');
console.log(`Connecting to PostgreSQL Database...`);
console.log(`Target Host: ${connectionString.split('@')[1]?.split('/')[0] || 'Neon DB'}`);
console.log('========================================================================\n');

const client = new Client({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

async function runMigrations() {
  try {
    await client.connect();
    console.log('✓ Successfully connected to PostgreSQL Database!\n');

    // Create flyway / schema tracking table if not exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version VARCHAR(50) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    const migrationsDir = path.resolve('db/migrations/dms');
    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.startsWith('V') && f.endsWith('.sql'))
      .sort((a, b) => {
        const numA = parseInt(a.split('__')[0].substring(1), 10);
        const numB = parseInt(b.split('__')[0].substring(1), 10);
        return numA - numB;
      });

    console.log(`Found ${files.length} SQL migration files in ${migrationsDir}.\n`);

    let appliedCount = 0;
    let skippedCount = 0;

    for (const file of files) {
      const version = file.split('__')[0];
      const checkRes = await client.query('SELECT version FROM schema_migrations WHERE version = $1', [version]);

      if (checkRes.rows.length > 0) {
        console.log(`  ⏭️  Skipping ${file} (already applied)`);
        skippedCount++;
        continue;
      }

      console.log(`  🚀 Applying ${file}...`);
      const filePath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(filePath, 'utf-8');

      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (version, name) VALUES ($1, $2)', [version, file]);
        await client.query('COMMIT');
        console.log(`  ✓ Applied ${file} successfully.`);
        appliedCount++;
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`  ❌ Failed to apply ${file}: ${err.message}`);
        throw err;
      }
    }

    console.log('\n========================================================================');
    console.log(`🎉 Database Migration Complete!`);
    console.log(`   Applied: ${appliedCount} | Skipped: ${skippedCount} | Total: ${files.length}`);
    console.log('========================================================================');
  } catch (err) {
    console.error('\n❌ Migration process failed:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigrations();
