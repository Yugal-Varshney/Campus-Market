/**
 * Architecture rules checked by reading the source files (no framework needed). They guard the decisions the
 * security design depends on, so a later change cannot quietly undo them.
 */
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = join(__dirname, '..');
let failed = 0;
const t = (name: string, cond: boolean, info = '') => { console.log(`${cond ? 'PASS' : 'FAIL'} ${name}${!cond && info ? `   [${info.slice(0, 200)}]` : ''}`); if (!cond) failed++; };

function walk(dir: string, exts: string[], out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next' || name.startsWith('.')) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, exts, out);
    else if (exts.some((e) => name.endsWith(e))) out.push(p);
  }
  return out;
}
const rel = (p: string) => relative(ROOT, p).replace(/\\/g, '/');
const read = (p: string) => readFileSync(p, 'utf8');

const appFiles = ['app', 'components', 'lib', 'types'].flatMap((d) => walk(join(ROOT, d), ['.ts', '.tsx'])).concat(join(ROOT, 'middleware.ts'));

// 1. The elevated database key must never appear in application code.
const leaks = appFiles.filter((f) => /service_role|SERVICE_ROLE/.test(read(f)));
t('no application file references the service-role key', leaks.length === 0, leaks.map(rel).join(', '));

// 2. No raw HTML injection anywhere.
const html = appFiles.filter((f) => /dangerouslySetInnerHTML|\.innerHTML\s*=/.test(read(f)));
t('no raw HTML injection (dangerouslySetInnerHTML / innerHTML)', html.length === 0, html.map(rel).join(', '));

// 3. Secrets must not be exposed to the browser through NEXT_PUBLIC_ variables.
const pub = appFiles.flatMap((f) => [...read(f).matchAll(/NEXT_PUBLIC_[A-Z_]+/g)].map((m) => m[0]));
const allowedPublic = new Set(['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'NEXT_PUBLIC_SITE_URL']);
t('only the three intended NEXT_PUBLIC_ variables are used', pub.every((n) => allowedPublic.has(n)), [...new Set(pub.filter((n) => !allowedPublic.has(n)))].join(', '));

// 4. Every server action checks who is calling (sign-in actions are public by nature).
const PUBLIC_ACTION_FILES = new Set(['lib/auth/actions.ts']);
for (const f of appFiles.filter((f) => /^['"]use server['"]/m.test(read(f).slice(0, 200)))) {
  if (PUBLIC_ACTION_FILES.has(rel(f))) continue;
  const parts = read(f).split(/export async function /).slice(1);
  const bad = parts.map((p) => p.split('(')[0]).filter((_, i) => !/getCurrentUser\(\)|await gate\(/.test(parts[i]));
  t(`every server action in ${rel(f)} checks the caller`, bad.length === 0, bad.join(', '));
}

// 5. Staff pages must call the role guard.
for (const f of appFiles.filter((f) => /\/(moderator|admin)\//.test(f.replace(/\\/g, '/')) && /page\.tsx$/.test(f))) {
  t(`${rel(f)} requires staff/admin`, /require(Staff|Admin)\(\)/.test(read(f)));
}

// 6. Database scripts. Migrations 004+ that open a transaction must close it; $$ must pair up.
const migDir = join(ROOT, 'supabase', 'migrations');
for (const f of walk(migDir, ['.sql'])) {
  const s = read(f);
  t(`${rel(f)}: dollar-quote markers pair up`, (s.match(/\$\$/g) ?? []).length % 2 === 0);
  const begins = (s.match(/^begin;/gim) ?? []).length, commits = (s.match(/^commit;/gim) ?? []).length;
  t(`${rel(f)}: begin/commit balanced`, begins === commits, `begin=${begins} commit=${commits}`);
}

// 7. "Read-only" scripts must contain no write statements (comments and quoted text are ignored).
const stripSql = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/--.*$/gm, '').replace(/\$\$[\s\S]*?\$\$/g, '').replace(/'(?:[^']|'')*'/g, "''");
const READ_ONLY = [...walk(join(ROOT, 'supabase', 'verification'), ['.sql']), join(migDir, '001_initial_review.sql'), join(migDir, '004_v3_preflight_audit.sql')].filter(existsSync);
const WRITE = /\b(insert\s+into|update\s+[\w."]+\s+set|delete\s+from|drop\s+(table|function|policy|index|trigger|schema|view)|alter\s+(table|function|policy|role)|create\s+(table|function|or\s+replace|policy|index|trigger)|truncate|grant\s|revoke\s)/i;
for (const f of READ_ONLY) {
  const m = stripSql(read(f)).match(WRITE);
  t(`${rel(f)} is read-only`, !m, m ? `found: ${m[0]}` : '');
}

// 8. Every test file is wired into `npm test`, so none can be forgotten.
const pkg = JSON.parse(read(join(ROOT, 'package.json')));
const testScript: string = pkg.scripts?.test ?? '';
for (const f of walk(join(ROOT, 'tests'), ['.test.ts'])) t(`${rel(f)} runs in "npm test"`, testScript.includes(rel(f).replace(/^tests\//, '')));

// 9. Security-relevant files exist.
for (const f of ['middleware.ts', 'lib/staff/auth.ts', 'lib/errors.ts', '.env.example']) t(`${f} exists`, existsSync(join(ROOT, f)));
t('.env.example holds no real keys', !/eyJ[A-Za-z0-9_-]{20,}|sb_secret_/.test(read(join(ROOT, '.env.example'))));

if (failed) { console.error(`\n${failed} test(s) failed`); process.exit(1); }
console.log('\nAll tests passed');
