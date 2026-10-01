#!/usr/bin/env node
/**
 * Mirrors each top-level astro-better-* directory into its own GitHub repo, so
 * every library stays individually cloneable even though it now lives here.
 *
 * Each directory names its target in `repositoryUrl.txt`, in the same partial
 * form the astro-better-code-snippet-extractor export template uses:
 *
 *   github.com/nathan-contino/astro-refs.git
 *
 * A directory without that file is skipped. The mirror is a full replacement:
 * everything in the target repo is removed and replaced with the directory's
 * contents, including .github, so the target is an exact copy. Nothing is
 * pushed when the result is identical to what is already there.
 *
 * Usage:
 *   scripts/mirror-packages.mjs --dry-run                 # what would change
 *   scripts/mirror-packages.mjs --base HEAD~1             # folders changed since
 *   scripts/mirror-packages.mjs --all                     # every folder
 *   scripts/mirror-packages.mjs --only astro-better-refs  # just these
 *
 * Auth:
 *   MIRROR_REPO_TOKEN   GitHub token with contents:write on the target repos.
 *                       Not needed for --dry-run.
 *
 * Exits non-zero if any mirror fails, after attempting all the others.
 */
import { execFileSync } from 'child_process';
import { readFileSync, existsSync, mkdtempSync, rmSync, cpSync } from 'fs';
import { tmpdir } from 'os';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { listPackageDirs } from './lib/packages.mjs';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const argv = process.argv.slice(2);
const DRY_RUN = argv.includes('--dry-run');
const ALL = argv.includes('--all');
const baseIndex = argv.indexOf('--base');
const BASE = baseIndex === -1 ? null : argv[baseIndex + 1];
const only = argv.reduce((acc, arg, i) => (arg === '--only' ? [...acc, argv[i + 1]] : acc), []);

if (argv.includes('--help') || argv.includes('-h')) {
  console.log(`Usage: scripts/mirror-packages.mjs [--dry-run] [--all | --base <ref> | --only <folder>...]

Mirrors each astro-better-* directory to the repo named in its repositoryUrl.txt.
Set MIRROR_REPO_TOKEN unless running --dry-run.`);
  process.exit(0);
}

const git = (args, opts = {}) =>
  execFileSync('git', args, { encoding: 'utf-8', ...opts });

/** Folders touched since `ref`, so a merge only pushes what it changed. */
function changedFolders(ref) {
  const changed = git(['-C', REPO_ROOT, 'diff', '--name-only', `${ref}..HEAD`])
    .split('\n').filter(Boolean);
  const folders = new Set();
  for (const file of changed) {
    const top = file.split('/')[0];
    if (top.startsWith('astro-better-')) folders.add(top);
  }
  return [...folders].sort();
}

const allFolders = listPackageDirs(REPO_ROOT);

let folders;
if (only.length) {
  const unknown = only.filter(f => !allFolders.includes(f));
  if (unknown.length) {
    console.error(`No such folder: ${unknown.join(', ')}`);
    process.exit(1);
  }
  folders = only;
} else if (ALL) {
  folders = allFolders;
} else if (BASE) {
  folders = changedFolders(BASE);
} else {
  console.error('Pass one of --all, --base <ref>, or --only <folder>.');
  process.exit(1);
}

if (!folders.length) {
  console.log('No astro-better-* folders changed, nothing to mirror.');
  process.exit(0);
}

const TOKEN = process.env.MIRROR_REPO_TOKEN;
const needsToken = folders.some(f => {
  const file = join(REPO_ROOT, f, 'repositoryUrl.txt');
  return existsSync(file) && !readFileSync(file, 'utf-8').includes('://');
});
if (!TOKEN && !DRY_RUN && needsToken) {
  console.error('MIRROR_REPO_TOKEN is not set. Pass --dry-run to preview without it.');
  process.exit(1);
}

const SOURCE_SHA = git(['-C', REPO_ROOT, 'rev-parse', 'HEAD']).trim();

console.log(`Mirroring ${folders.length} folder(s) from ${SOURCE_SHA.slice(0, 9)}\n`);

const mirrored = [];
const unchanged = [];
const skipped = [];
const failed = [];

for (const folder of folders) {
  const urlFile = join(REPO_ROOT, folder, 'repositoryUrl.txt');
  if (!existsSync(urlFile)) {
    console.log(`  ${folder}: no repositoryUrl.txt, skipping`);
    skipped.push(folder);
    continue;
  }
  const target = readFileSync(urlFile, 'utf-8').replace(/\s/g, '');
  // A bare `github.com/owner/repo.git` gets the token prepended. Anything with
  // an explicit scheme is used as-is, which is what makes a local file:// repo
  // usable for testing this script end to end.
  const remote = target.includes('://') ? target : `https://x-access-token:${TOKEN}@${target}`;

  if (DRY_RUN) {
    console.log(`  ${folder} -> ${target}`);
    mirrored.push(folder);
    continue;
  }

  const clone = mkdtempSync(join(tmpdir(), 'bss-mirror-'));
  try {
    git(['clone', '--depth', '1', remote, clone], { stdio: 'pipe' });

    const inClone = args => git(['-C', clone, ...args], { stdio: 'pipe' });
    inClone(['config', 'user.email', 'github-actions[bot]@users.noreply.github.com']);
    inClone(['config', 'user.name', 'github-actions[bot]']);

    // Full replacement: drop everything tracked, then copy the folder in. The
    // .git directory is untouched, so history is preserved.
    inClone(['rm', '-rq', '--ignore-unmatch', '.']);
    git(['-C', clone, 'clean', '-fdxq']);
    // repositoryUrl.txt is monorepo plumbing and means nothing in the target,
    // so it stays behind, as it does in the extractor's reference script.
    cpSync(join(REPO_ROOT, folder), clone, {
      recursive: true,
      filter: src => {
        const parts = src.split('/');
        return !parts.includes('node_modules')
          && !parts.includes('.git')
          && !src.endsWith('/repositoryUrl.txt');
      },
    });

    inClone(['add', '-A']);
    const staged = git(['-C', clone, 'diff', '--cached', '--name-only']).trim();
    if (!staged) {
      console.log(`  ${folder}: already up to date`);
      unchanged.push(folder);
      continue;
    }

    inClone(['commit', '-m', `chore: sync from better-static-sites ${SOURCE_SHA}`]);
    git(['-C', clone, 'push', 'origin', 'HEAD'], { stdio: 'pipe' });
    console.log(`  ${folder} -> ${target}  (${staged.split('\n').length} file(s))`);
    mirrored.push(folder);
  } catch (err) {
    // Never let a token reach the log.
    let message = String(err.stderr || err.message);
    if (TOKEN) message = message.replaceAll(TOKEN, '***');
    console.error(`  ${folder}: FAILED\n${message}`);
    failed.push(folder);
  } finally {
    rmSync(clone, { recursive: true, force: true });
  }
}

console.log('\n=== Mirror summary ===');
if (mirrored.length) console.log(`  ${DRY_RUN ? 'would mirror' : 'mirrored'}: ${mirrored.join(', ')}`);
if (unchanged.length) console.log(`  up to date:   ${unchanged.join(', ')}`);
if (skipped.length) console.log(`  skipped:      ${skipped.join(', ')}`);
if (failed.length) console.error(`  FAILED:       ${failed.join(', ')}`);
process.exit(failed.length ? 1 : 0);
