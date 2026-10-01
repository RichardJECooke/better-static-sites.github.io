/**
 * Shared package discovery for the publish and mirror scripts.
 *
 * Every publishable package lives under a top-level `astro-better-*` directory,
 * but not one per directory: astro-better-code-blocks and
 * astro-better-declarative-screenshots each hold two, and the latter's own
 * package.json is a private workspace root rather than a package. So discovery
 * walks for package.json rather than assuming one per folder.
 */
import { readdirSync, readFileSync, existsSync, statSync } from 'fs';
import { join, relative } from 'path';

const PACKAGE_DIR_PREFIX = 'astro-better-';

/** Top-level `astro-better-*` directories, which are the mirror units. */
export function listPackageDirs(repoRoot) {
  return readdirSync(repoRoot, { withFileTypes: true })
    .filter(e => e.isDirectory() && e.name.startsWith(PACKAGE_DIR_PREFIX))
    .map(e => e.name)
    .sort();
}

/**
 * Every publishable package: { name, version, dir, folder }.
 * `folder` is the top-level directory, which is the mirror unit; `dir` is where
 * the package.json actually lives. Private manifests and workspace roots are
 * skipped, as is anything without a name or version.
 */
export function listPackages(repoRoot) {
  const found = [];

  for (const folder of listPackageDirs(repoRoot)) {
    const folderPath = join(repoRoot, folder);

    const walk = dir => {
      const manifestPath = join(dir, 'package.json');
      if (existsSync(manifestPath)) {
        let manifest;
        try {
          manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
        } catch (err) {
          throw new Error(`${relative(repoRoot, manifestPath)}: ${err.message}`);
        }
        if (!manifest.private && manifest.name && manifest.version) {
          found.push({ name: manifest.name, version: manifest.version, dir, folder, manifest });
          return; // a package does not contain another package
        }
      }
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue;
        if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
        walk(join(dir, entry.name));
      }
    };

    if (statSync(folderPath).isDirectory()) walk(folderPath);
  }

  return found.sort((a, b) => a.name.localeCompare(b.name));
}
