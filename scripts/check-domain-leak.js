const fs = require('fs');
const path = require('path');

const FORBIDDEN_PATTERN = /jyotirmoyb\.com/i;
const EXCLUDED_PATHS = [
  'README.md',
  'CLAUDE.md',
  '.cursorrules',
  'docs',
  'DMS/docs',
  'scripts/check-domain-leak.js',
  '.env.example',
  '.env.production',
  '.dart_tool',
  'build'
];

function scanDirectory(dir, matches = []) {
  if (!fs.existsSync(dir)) return matches;
  const items = fs.readdirSync(dir);

  for (const item of items) {
    // Skip node_modules, git, turbo, dist, build, and dart_tool directories
    if (item === 'node_modules' || item === '.git' || item === '.turbo' || item === 'dist' || item === 'build' || item === '.dart_tool') continue;
    const fullPath = path.join(dir, item);
    const relPath = path.relative(process.cwd(), fullPath).replace(/\\/g, '/');

    if (
      relPath === 'README.md' ||
      relPath === 'CLAUDE.md' ||
      relPath === '.cursorrules' ||
      relPath.startsWith('docs/') ||
      relPath.includes('/docs/') ||
      relPath === '.env.example' ||
      relPath === '.env.production' ||
      relPath === 'scripts/check-domain-leak.js' ||
      relPath.endsWith('.dill')
    ) {
      continue;
    }

    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      scanDirectory(fullPath, matches);
    } else {
      const content = fs.readFileSync(fullPath, 'utf8');
      const lines = content.split('\n');
      lines.forEach((line, idx) => {
        if (FORBIDDEN_PATTERN.test(line)) {
          matches.push({ file: relPath, line: idx + 1, content: line.trim() });
        }
      });
    }
  }
  return matches;
}

const violations = scanDirectory(process.cwd());

if (violations.length > 0) {
  console.error('❌ DOMAIN LEAK DETECTED! Hardcoded "jyotirmoyb.com" found in source code:');
  violations.forEach((v) => console.error(`   - ${v.file}:${v.line}: ${v.content}`));
  process.exit(1);
} else {
  console.log('✅ DOMAIN LEAK CHECK PASSED! No hardcoded "jyotirmoyb.com" found in source code.');
  process.exit(0);
}
