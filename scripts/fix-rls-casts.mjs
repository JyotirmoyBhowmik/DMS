import fs from 'fs';
import path from 'path';

const dir = path.resolve('db/migrations/dms');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.sql'));

let count = 0;
for (const file of files) {
  const filePath = path.join(dir, file);
  let sql = fs.readFileSync(filePath, 'utf-8');
  if (sql.includes("tenant_id = current_setting('app.current_tenant_id', true)")) {
    sql = sql.replaceAll(
      "tenant_id = current_setting('app.current_tenant_id', true)",
      "tenant_id::text = current_setting('app.current_tenant_id', true)"
    );
    fs.writeFileSync(filePath, sql, 'utf-8');
    console.log(`Updated RLS policy in ${file}`);
    count++;
  }
}

console.log(`Successfully updated ${count} migration files with UUID::text casting.`);
