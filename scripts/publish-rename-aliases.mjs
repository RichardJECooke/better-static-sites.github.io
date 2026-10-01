#!/usr/bin/env node
/**
 * One-time: publishes the alias packages in rename-aliases/ under their old npm
 * names, then marks each old name deprecated so installs warn and point at the
 * replacement.
 *
 * `npm deprecate` is the registry-level mechanism for a rename, so it runs
 * against the whole version range rather than just the new version. The result
 * is that existing installs keep resolving and keep working, while anyone
 * installing fresh sees where the package moved to.
 *
 * Run this only after the replacement packages are on npm, since each alias
 * depends on its replacement.
 *
 * Usage:
 *   scripts/publish-rename-aliases.mjs --dry-run
 *   NPM_TOKEN=... scripts/publish-rename-aliases.mjs
 *   NPM_TOKEN=... scripts/publish-rename-aliases.mjs --only astro-refs
 *   NPM_TOKEN=... scripts/publish-rename-aliases.mjs --deprecate-only
 *
 * This is deliberately not wired into a workflow: it runs once per rename, and
 * publishing under a name you are retiring should be a deliberate act.
 */
import { execFileSync } from 'child_process';
import { readFileSync, readdirSync, mkdtempSync, writeFileSync, rmSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ALIAS_ROOT = join(REPO_ROOT, 'rename-aliases');

const argv = process.argv.slice(2);
const DRY_RUN = argv.includes('--dry-run');
const DEPRECATE_ONLY = argv.includes('--deprecate-only');
const PROVENANCE = argv.includes('--provenance');
const only = argv.reduce((acc, arg, i) => (arg === '--only' ? [...acc, argv[i + 1]] : acc), []);

if (argv.includes('--help') || argv.includes('-h')) {
  console.log(`Usage: scripts/publish-rename-aliases.mjs [--dry-run] [--only <name>]... [--deprecate-only] [--provenance]

Publishes rename-aliases/* under their old names and deprecates those names.
Run it after the replacement packages are published. Set NPM_TOKEN.`);
  process.exit(0);
}

if (!existsSync(ALIAS_ROOT)) {
  console.error('rename-aliases/ does not exist. Run scripts/build-rename-aliases.mjs first.');
  process.exit(1);
}

const aliases = readdirSync(ALIAS_ROOT, { withFileTypes: true })
  .filter(e => e.isDirectory())
  .map(e => {
    const dir = join(ALIAS_ROOT, e.name);
    const manifest = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf-8'));
    return {
      dir,
      name: manifest.name,
      version: manifest.version,
      replacement: Object.keys(manifest.dependencies ?? {})[0],
    };
  })
  .filter(a => !only.length || only.includes(a.name))
  .sort((a, b) => a.name.localeCompare(b.name));

if (only.length) {
  const missing = only.filter(n => !aliases.some(a => a.name === n));
  if (missing.length) {
    console.error(`No such alias: ${missing.join(', ')}`);
    process.exit(1);
  }
}

/** True when the replacement is on npm. An alias without it would not install. */
async function isPublished(name, version) {
  const res = await fetch(`https://registry.npmjs.org/${encodeURIComponent(name)}`, {
    headers: { accept: 'application/vnd.npm.install-v1+json' },
  });
  if (res.status === 404) return false;
  if (!res.ok) throw new Error(`registry lookup for ${name} failed: ${res.status}`);
  const body = await res.json();
  return version ? version in (body.versions ?? {}) : true;
}

console.log(`${aliases.length} alias package(s)\n`);

const blocked = [];
for (const alias of aliases) {
  if (!(await isPublished(alias.replacement))) {
    blocked.push(`${alias.name} needs ${alias.replacement} on npm first`);
  }
}
if (blocked.length) {
  console.error('Replacements are not published yet:');
  for (const b of blocked) console.error(`  ${b}`);
  console.error('\nRun scripts/publish-packages.mjs first, or let the publish workflow run.');
  process.exit(1);
}

// One npm config for the run, so NPM_TOKEN behaves the same locally and in CI.
let configDir = null;
const env = { ...process.env };
if (process.env.NPM_TOKEN) {
  configDir = mkdtempSync(join(tmpdir(), 'bss-npm-'));
  const configPath = join(configDir, '.npmrc');
  writeFileSync(configPath, `//registry.npmjs.org/:_authToken=${process.env.NPM_TOKEN}\n`, { mode: 0o600 });
  env.npm_config_userconfig = configPath;
} else if (!DRY_RUN) {
  console.log('NPM_TOKEN not set, relying on your existing npm login.\n');
}

const done = [];
const failed = [];

try {
  for (const alias of aliases) {
    const message = `Renamed to ${alias.replacement}. Install that instead; this name is no longer updated.`;

    if (!DEPRECATE_ONLY) {
      const already = await isPublished(alias.name, alias.version);
      if (already) {
        console.log(`${alias.name}@${alias.version} already published, skipping publish`);
      } else if (DRY_RUN) {
        console.log(`would publish  ${alias.name}@${alias.version} -> depends on ${alias.replacement}`);
      } else {
        const args = ['publish', '--access', 'public'];
        if (PROVENANCE) args.push('--provenance');
        console.log(`\n--- npm ${args.join(' ')}  (${alias.name}@${alias.version})`);
        try {
          execFileSync('npm', args, { cwd: alias.dir, stdio: 'inherit', env });
        } catch {
          failed.push(`${alias.name}@${alias.version} (publish)`);
          continue;
        }
      }
    }

    // Deprecating the full range covers every past version, not just the last.
    const range = `${alias.name}@<=${alias.version}`;
    if (DRY_RUN) {
      console.log(`would deprecate  ${range}\n    "${message}"`);
      done.push(alias.name);
      continue;
    }
    console.log(`--- npm deprecate ${range}`);
    try {
      execFileSync('npm', ['deprecate', range, message], { stdio: 'inherit', env });
      done.push(alias.name);
    } catch {
      failed.push(`${alias.name} (deprecate)`);
    }
  }
} finally {
  if (configDir) rmSync(configDir, { recursive: true, force: true });
}

console.log('\n=== Summary ===');
for (const d of done) console.log(`  ${DRY_RUN ? 'would handle' : 'done'}: ${d}`);
for (const f of failed) console.error(`  FAILED: ${f}`);
process.exit(failed.length ? 1 : 0);
