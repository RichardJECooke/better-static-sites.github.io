#!/usr/bin/env node
/**
 * Generates the one-time alias packages published under the old npm names.
 *
 * Five packages were renamed to take the astro-better prefix, and one
 * (generate-declarative-screenshots) was renamed for the same reason. Anyone
 * depending on an old name should keep building, so each old name gets one
 * final version that depends on the new package and re-exports its whole
 * surface. Paired with `npm deprecate`, installs keep working and warn.
 *
 * Output lands in rename-aliases/<old-name>/, which is deliberately outside the
 * astro-better-* glob so neither the publish job nor the mirror job touches it.
 * Once every old name is published and deprecated, this directory and this
 * script can be deleted.
 *
 * Usage:
 *   scripts/build-rename-aliases.mjs           # write rename-aliases/
 *   scripts/build-rename-aliases.mjs --check    # verify without writing
 */
import { mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_ROOT = join(REPO_ROOT, 'rename-aliases');
const CHECK = process.argv.includes('--check');

const REPO_URL = 'git+https://github.com/better-static-sites/better-static-sites.github.io.git';
const LICENSE = readFileSync(join(REPO_ROOT, 'LICENSE.md'), 'utf-8');

/**
 * `version` is the final version published under the old name, one patch above
 * what is on npm today. `astro` entries are wrapper components; `slot: true`
 * means the original forwards children.
 */
const ALIASES = [
  {
    old: 'astro-refs',
    version: '0.1.2',
    replacement: 'astro-better-refs',
    replacementRange: '^0.1.1',
    peerDependencies: { astro: '>=4.0.0' },
    astro: [{ file: 'Ref.astro', subpath: './Ref.astro', slot: false }],
  },
  {
    old: 'astro-mermaid-renderer-cli-smol',
    version: '0.1.2',
    replacement: 'astro-better-mermaid',
    replacementRange: '^0.1.1',
    peerDependencies: { astro: '>=4.0.0', mermaid: '>=10.0.0' },
    css: [{ file: 'styles.css', subpath: './styles.css' }],
  },
  {
    old: 'astro-link-checker',
    version: '1.0.1',
    replacement: 'astro-better-link-checker',
    replacementRange: '^1.0.0',
    peerDependencies: { astro: '>=4.0.0' },
  },
  {
    old: 'astro-gen-markdown-pages',
    version: '1.1.1',
    replacement: 'astro-better-gen-markdown-pages',
    replacementRange: '^1.1.0',
    peerDependencies: { astro: '>=4.0.0' },
    astro: [{ file: 'MarkdownOnly.astro', subpath: './MarkdownOnly.astro', slot: true }],
  },
  {
    old: 'astro-toc-smol',
    version: '1.1.3',
    replacement: 'astro-better-toc',
    replacementRange: '^1.1.2',
    peerDependencies: { astro: '>=4.0.0' },
    astro: [
      { file: 'TOC.astro', subpath: './TOC.astro', slot: false },
      { file: 'InlineTOC.astro', subpath: './InlineTOC.astro', slot: false },
    ],
  },
  {
    old: 'generate-declarative-screenshots',
    version: '0.4.3',
    replacement: 'astro-better-generate-screenshots',
    replacementRange: '^0.4.2',
    bin: {
      'take-screenshots': 'scripts/take-screenshots.mjs',
      'check-screenshots': 'scripts/check-screenshots.mjs',
    },
  },
];

const written = [];
const mismatched = [];

for (const alias of ALIASES) {
  const dir = join(OUT_ROOT, alias.old);
  const files = {};

  // `export *` does not carry a default, and every one of these has both.
  files['index.mjs'] =
    `// ${alias.old} is now ${alias.replacement}. This re-export keeps existing\n` +
    `// imports working; please switch to ${alias.replacement}.\n` +
    `export * from '${alias.replacement}';\n` +
    `export { default } from '${alias.replacement}';\n`;

  const exportsMap = { '.': './index.mjs' };

  for (const component of alias.astro ?? []) {
    const children = component.slot ? '<slot />' : '';
    const open = component.slot
      ? `<Target {...Astro.props}>${children}</Target>`
      : '<Target {...Astro.props} />';
    files[component.file] =
      '---\n' +
      `// ${alias.old} is now ${alias.replacement}.\n` +
      `import Target from '${alias.replacement}/${component.file}';\n` +
      '---\n' +
      `${open}\n`;
    exportsMap[component.subpath] = `./${component.file}`;
  }

  for (const sheet of alias.css ?? []) {
    files[sheet.file] =
      `/* ${alias.old} is now ${alias.replacement}. */\n` +
      `@import '${alias.replacement}/${sheet.file}';\n`;
    exportsMap[sheet.subpath] = `./${sheet.file}`;
  }

  const binMap = {};
  for (const [name, target] of Object.entries(alias.bin ?? {})) {
    const file = `bin/${name}.mjs`;
    files[file] =
      '#!/usr/bin/env node\n' +
      `// ${alias.old} is now ${alias.replacement}.\n` +
      `await import('${alias.replacement}/${target}');\n`;
    binMap[name] = `./${file}`;
  }

  files['README.md'] =
    `# ${alias.old}\n\n` +
    `> Renamed to [\`${alias.replacement}\`](https://www.npmjs.com/package/${alias.replacement}).\n\n` +
    `This package is deprecated. Version ${alias.version} is a thin re-export of\n` +
    `\`${alias.replacement}\` so existing installs keep working, and it is the last\n` +
    `release under this name.\n\n` +
    '## Migrating\n\n' +
    '```\n' +
    `npm uninstall ${alias.old}\n` +
    `npm install ${alias.replacement}\n` +
    '```\n\n' +
    'Then update your imports:\n\n' +
    '```diff\n' +
    `-import x from '${alias.old}';\n` +
    `+import x from '${alias.replacement}';\n` +
    '```\n\n' +
    `Everything else is unchanged. See the [documentation](https://better-static-sites.github.io).\n`;

  files['LICENSE.md'] = LICENSE;

  const manifest = {
    name: alias.old,
    version: alias.version,
    description: `Deprecated: renamed to ${alias.replacement}`,
    keywords: ['deprecated', 'renamed', alias.replacement],
    license: 'MIT',
    repository: { type: 'git', url: REPO_URL, directory: `rename-aliases/${alias.old}` },
    homepage: `https://www.npmjs.com/package/${alias.replacement}`,
    bugs: { url: 'https://github.com/better-static-sites/better-static-sites.github.io/issues' },
    type: 'module',
    ...(Object.keys(binMap).length ? { bin: binMap } : {}),
    exports: exportsMap,
    files: ['index.mjs', '*.astro', '*.css', 'bin/'],
    dependencies: { [alias.replacement]: alias.replacementRange },
    ...(alias.peerDependencies ? { peerDependencies: alias.peerDependencies } : {}),
  };
  files['package.json'] = `${JSON.stringify(manifest, null, 2)}\n`;

  for (const [name, content] of Object.entries(files)) {
    const path = join(dir, name);
    if (CHECK) {
      if (!existsSync(path) || readFileSync(path, 'utf-8') !== content) {
        mismatched.push(`${alias.old}/${name}`);
      }
      continue;
    }
    mkdirSync(dirname(path), { recursive: true });
    // bin shims need the executable bit to survive into the npm tarball
    writeFileSync(path, content, name.startsWith('bin/') ? { mode: 0o755 } : undefined);
  }
  written.push(`${alias.old}@${alias.version} -> ${alias.replacement}`);
}

if (CHECK) {
  if (mismatched.length) {
    console.error(`${mismatched.length} alias file(s) out of date:`);
    for (const m of mismatched) console.error(`  ${m}`);
    process.exit(1);
  }
  console.log('rename-aliases/ matches this script.');
  process.exit(0);
}

console.log(`Wrote ${written.length} alias package(s) to rename-aliases/:`);
for (const w of written) console.log(`  ${w}`);
console.log('\nPublish them with: scripts/publish-rename-aliases.mjs');
