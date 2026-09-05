import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';

const root = new URL('../', import.meta.url);

const read = path => readFile(new URL(path, root), 'utf8');

const collectSourceFiles = async directory => {
  const absolute = new URL(directory, root);
  const entries = await readdir(absolute, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const relative = join(directory, entry.name).replaceAll('\\', '/');
    if (entry.isDirectory()) files.push(...await collectSourceFiles(`${relative}/`));
    else if (/\.(ts|tsx)$/.test(entry.name)) files.push(relative);
  }

  return files;
};

const failures = [];
const headers = await read('public/_headers');
const requiredHeaders = [
  'Content-Security-Policy',
  'Strict-Transport-Security',
  'Referrer-Policy',
  'X-Content-Type-Options',
  'Permissions-Policy',
];

for (const header of requiredHeaders) {
  if (!headers.includes(header)) failures.push(`Missing hosting header: ${header}`);
}

// This file is a superseded local-only blueprint retained for security
// regression evidence. It is intentionally outside the active Supabase
// migration history because it was never applied to the canonical remote.
const legacySecurityBlueprint = await read('supabase/archive/202607270001_security_foundation.sql');
for (const table of ['profiles', 'route_requests', 'driver_routes', 'match_previews', 'security_audit_events']) {
  if (!legacySecurityBlueprint.includes(`alter table public.${table} enable row level security`)) {
    failures.push(`Archived security blueprint is missing RLS for ${table}`);
  }
}

const allowedStorageFile = 'src/security/securityPolicy.ts';
for (const file of await collectSourceFiles('src/')) {
  if (file === allowedStorageFile) continue;
  const source = await read(file);
  if (/\b(localStorage|sessionStorage)\b/.test(source)) {
    failures.push(`Sensitive browser storage API found outside the approved migration boundary: ${file}`);
  }
}

if (failures.length > 0) {
  console.error(failures.join('\n'));
  process.exitCode = 1;
} else {
  console.log('Security configuration checks passed.');
}
