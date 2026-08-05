import fs from 'fs';
import path from 'path';
import pg from 'pg';

const { Client } = pg;

// Connection string setup
const connectionString = process.env.DATABASE_URL || 
  process.env.CONNECTION_STRING || 
  "postgresql://neondb_owner:npg_2HQSygvRT5qZ@ep-falling-cloud-azy5iaz6-pooler.c-3.ap-southeast-1.aws.neon.tech/neondb?sslmode=require";

console.log('========================================================================');
console.log('⚡ DMS Multi-Service Database Migration Runner');
console.log(`Target Host: ${connectionString.split('@')[1]?.split('/')[0] || 'Neon DB'}`);
console.log('========================================================================\n');

const client = new Client({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

// Order of execution for service migration folders
const folderOrder = [
  'system',
  'identity',
  'dms',
  'sfa',
  'pricing',
  'schemes',
  'claims',
  'finance',
  'audit',
  'config',
  'file',
  'forecasting',
  'notification',
  'recommendation',
  'report'
];

async function runAllMigrations() {
  try {
    await client.connect();
    console.log('✓ Successfully connected to PostgreSQL Database!\n');

    // Create tracking table
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version VARCHAR(255) PRIMARY KEY,
        folder VARCHAR(100),
        name VARCHAR(255),
        applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
      ALTER TABLE schema_migrations ADD COLUMN IF NOT EXISTS folder VARCHAR(100);
      ALTER TABLE schema_migrations ADD COLUMN IF NOT EXISTS name VARCHAR(255);
    `);

    const baseDir = path.resolve('db/migrations');
    let totalApplied = 0;
    let totalSkipped = 0;
    let totalFiles = 0;

    // Get all directories in db/migrations
    const existingFolders = fs.readdirSync(baseDir).filter(f => {
      return fs.statSync(path.join(baseDir, f)).isDirectory();
    });

    // Merge predefined order with any remaining folders
    const orderedFolders = [
      ...folderOrder.filter(f => existingFolders.includes(f)),
      ...existingFolders.filter(f => !folderOrder.includes(f))
    ];

    for (const folder of orderedFolders) {
      const folderPath = path.join(baseDir, folder);
      const sqlFiles = fs.readdirSync(folderPath)
        .filter(f => f.endsWith('.sql'))
        .sort((a, b) => {
          const numA = parseInt(a.replace(/\D/g, '') || '0', 10);
          const numB = parseInt(b.replace(/\D/g, '') || '0', 10);
          return numA - numB;
        });

      if (sqlFiles.length === 0) continue;

      console.log(`📁 Processing Service Folder: db/migrations/${folder} (${sqlFiles.length} files)`);

      for (const file of sqlFiles) {
        totalFiles++;
        const migrationKey = `${folder}/${file}`;
        const versionPrefix = file.split('__')[0];
        const checkRes = await client.query(
          'SELECT version FROM schema_migrations WHERE version = $1 OR version = $2',
          [migrationKey, versionPrefix]
        );

        if (checkRes.rows.length > 0) {
          console.log(`  ⏭️  Skipping ${migrationKey} (already applied)`);
          totalSkipped++;
          continue;
        }

        console.log(`  🚀 Applying ${migrationKey}...`);
        const filePath = path.join(folderPath, file);
        const sql = fs.readFileSync(filePath, 'utf-8');

        await client.query('BEGIN');
        try {
          await client.query(sql);
          await client.query(
            'INSERT INTO schema_migrations (version, folder, name) VALUES ($1, $2, $3)',
            [migrationKey, folder, file]
          );
          await client.query('COMMIT');
          console.log(`  ✓ Applied ${migrationKey} successfully.`);
          totalApplied++;
        } catch (err) {
          await client.query('ROLLBACK');
          console.error(`  ❌ Failed to apply ${migrationKey}: ${err.message}`);
          throw err;
        }
      }
      console.log('');
    }

    console.log('========================================================================');
    console.log(`🎉 All Multi-Service Database Migrations Complete!`);
    console.log(`   Applied: ${totalApplied} | Skipped: ${totalSkipped} | Total Files: ${totalFiles}`);
    console.log('========================================================================');
  } catch (err) {
    console.error('\n❌ Migration process failed:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runAllMigrations();
