#!/usr/bin/env node
/**
 * Publishes every package whose package.json version is not yet on npm.
 *
 * The check is against the registry rather than a git diff, which matters here:
 * a first publish has no version bump to detect (the five renamed packages have
 * no npm history at all), a re-run after a half-failed publish needs to skip
 * what already landed, and a squash merge flattens the bump out of the diff.
 * Asking the registry answers "does this version exist" directly, so the job is
 * idempotent and safe to re-run.
 *
 * Usage:
 *   scripts/publish-packages.mjs --dry-run           # what would publish
 *   scripts/publish-packages.mjs                      # publish
 *   scripts/publish-packages.mjs --only astro-better-refs [--only ...]
 *   scripts/publish-packages.mjs --no-provenance      # outside GitHub Actions
 *
 * Auth:
 *   NPM_TOKEN   npm automation token with publish rights. Used the same way
 *               locally and in CI: the script writes it to a temporary npm
 *               config for the duration of the run. If unset, it falls back to
 *               whatever `npm login` already configured.
 *
 * Provenance is on by default and requires the job to run in GitHub Actions
 * with `id-token: write`. Locally, pass --no-provenance.
 *
 * Exits non-zero if any publish fails, after attempting all the others.
 */
import { execFileSync } from 'child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { listPackages } from './lib/packages.mjs';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const argv = process.argv.slice(2);
const DRY_RUN = argv.includes('--dry-run');
const PROVENANCE = !argv.includes('--no-provenance');
const only = argv.reduce((acc, arg, i) => (arg === '--only' ? [...acc, argv[i + 1]] : acc), []);

if (argv.includes('--help') || argv.includes('-h')) {
  console.log(`Usage: scripts/publish-packages.mjs [--dry-run] [--only <name>]... [--no-provenance]

Publishes any package whose version is not already on npm.
Set NPM_TOKEN, or be logged in locally. Provenance needs GitHub Actions.`);
  process.exit(0);
}

/** Versions already on the registry, or null when the package is brand new. */
async function publishedVersions(name) {
  const res = await fetch(`https://registry.npmjs.org/${encodeURIComponent(name)}`, {
    headers: { accept: 'application/vnd.npm.install-v1+json' },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`registry lookup for ${name} failed: ${res.status} ${res.statusText}`);
  const body = await res.json();
  return { all: Object.keys(body.versions ?? {}), latest: body['dist-tags']?.latest };
}

const packages = listPackages(REPO_ROOT)
  .filter(p => !only.length || only.includes(p.name));

if (only.length) {
  const missing = only.filter(n => !packages.some(p => p.name === n));
  if (missing.length) {
    console.error(`No such package: ${missing.join(', ')}`);
    process.exit(1);
  }
}

console.log(`Checking ${packages.length} package(s) against the registry\n`);

const toPublish = [];
for (const pkg of packages) {
  const registry = await publishedVersions(pkg.name);
  if (registry === null) {
    console.log(`  ${pkg.name}@${pkg.version}  new package, will publish`);
    toPublish.push(pkg);
  } else if (!registry.all.includes(pkg.version)) {
    console.log(`  ${pkg.name}@${pkg.version}  new version (registry latest ${registry.latest}), will publish`);
    toPublish.push(pkg);
  } else {
    console.log(`  ${pkg.name}@${pkg.version}  already published, skipping`);
  }
}

if (!toPublish.length) {
  console.log('\nNothing to publish.');
  process.exit(0);
}

console.log(`\n${DRY_RUN ? 'Would publish' : 'Publishing'} ${toPublish.length} package(s)`);

if (DRY_RUN) {
  for (const pkg of toPublish) console.log(`  ${pkg.name}@${pkg.version}`);
  console.log('\nDry run, nothing published.');
  process.exit(0);
}

// One npm config for the whole run, so NPM_TOKEN works the same locally as in
// CI and never gets written into the repo.
let configDir = null;
const env = { ...process.env };
if (process.env.NPM_TOKEN) {
  configDir = mkdtempSync(join(tmpdir(), 'bss-npm-'));
  const configPath = join(configDir, '.npmrc');
  writeFileSync(configPath, `//registry.npmjs.org/:_authToken=${process.env.NPM_TOKEN}\n`, { mode: 0o600 });
  env.npm_config_userconfig = configPath;
} else {
  console.log('NPM_TOKEN not set, relying on your existing npm login.');
}

const published = [];
const failed = [];

try {
  for (const pkg of toPublish) {
    // --access public is required for a first publish; a no-op afterwards.
    const args = ['publish', '--access', 'public'];
    if (PROVENANCE) args.push('--provenance');

    console.log(`\n--- npm ${args.join(' ')}  (${pkg.name}@${pkg.version})`);
    try {
      execFileSync('npm', args, { cwd: pkg.dir, stdio: 'inherit', env });
      published.push(`${pkg.name}@${pkg.version}`);
    } catch {
      failed.push(`${pkg.name}@${pkg.version}`);
    }
  }
} finally {
  if (configDir) rmSync(configDir, { recursive: true, force: true });
}

console.log('\n=== Publish summary ===');
for (const p of published) console.log(`  published: ${p}`);
for (const f of failed) console.error(`  FAILED:    ${f}`);
process.exit(failed.length ? 1 : 0);
