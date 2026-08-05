import fs from 'fs';
import path from 'path';

function scanDir(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      results = results.concat(scanDir(fullPath));
    } else if (file.endsWith('.sql')) {
      results.push(fullPath);
    }
  }
  return results;
}

const baseDir = path.resolve('db/migrations');
const files = scanDir(baseDir);

let count = 0;
for (const filePath of files) {
  let sql = fs.readFileSync(filePath, 'utf-8');
  if (sql.includes("tenant_id = current_setting('app.current_tenant_id', true)") || sql.includes("tenant_id = current_setting('app.tenant_id', true)")) {
    sql = sql.replaceAll(
      "tenant_id = current_setting('app.current_tenant_id', true)",
      "tenant_id::text = current_setting('app.current_tenant_id', true)"
    ).replaceAll(
      "tenant_id = current_setting('app.tenant_id', true)",
      "tenant_id::text = current_setting('app.tenant_id', true)"
    );
    fs.writeFileSync(filePath, sql, 'utf-8');
    console.log(`Updated RLS policy in ${path.relative(process.cwd(), filePath)}`);
    count++;
  }
}

console.log(`Successfully updated ${count} SQL migration files across all service folders.`);
