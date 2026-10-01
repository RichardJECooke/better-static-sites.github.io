# Better Static Sites

A standard library of common tools and components you might need to build a nice static site.

Does this suite contain the best tools around? I can't answer that question. But they're certainly _better_ than something.

## This repo

This repo holds both the `astro-better-*` packages and the documentation site for them. Each
package lives in its own top-level directory, and the docs site at the root is built with
Astro 7 using the packages it documents (sidebar, nav bar, steps, tabs, admonitions, TOC, etc.)
in its own layout.

Most top-level directories are one package, but two hold more than one:

| Directory | Packages |
|---|---|
| `astro-better-code-blocks/` | `astro-better-code-blocks`, `astro-better-code-snippet-extractor` |
| `astro-better-declarative-screenshots/` | `astro-better-declarative-screenshots` (`use-screenshots/`), `astro-better-generate-screenshots` (`generate-screenshots/`) |

Eighteen packages in sixteen directories. Anything that walks the packages should look for
`package.json` rather than assume one per directory; `scripts/lib/packages.mjs` does this and
is shared by the release scripts.

## Local development

The docs site depends on the packages by their published npm names, so `npm install` pulls them
from the registry rather than from these directories.

```shell-session
# install deps
npm install

# start dev server at http://localhost:4321
npm run dev

# production build to dist/
npm run build

# preview the production build locally
npm run preview
```

To work against your local changes to a package instead of the published version, point the
dependency at the directory (`"astro-better-refs": "file:./astro-better-refs"`) or use
`npm link`. Don't commit that.

## Production build

```shell-session
npm run build
```

Output goes to `dist/`. The `astro-better-gen-markdown-pages` integration also writes `.md`
companion files and `dist/llms.txt` at build time.

## Screenshots

Screenshots are generated with Playwright via a separate npm install in `screenshots/`
to keep browser binaries out of the main `node_modules`.

### One-time setup

```shell-session
cd screenshots
npm install
npx playwright install webkit --with-deps
```

### Generate Screenshots

Run from the repo root to first build the site, then start the Docker
container defined in `screenshots/docker-compose.yml`, then capture every `<Screenshot>`
declared in `src/`, and write PNGs to `public/img/screenshots/`:

```shell-session
npm run screenshots
```

Commit the generated PNGs. Regular docs builds read them from disk, no Playwright
or Docker involved.

### Checking for drift

`check-screenshots` does not rebuild. Run `npm run screenshots` first if `dist/` is stale.

```shell-session
npm run check-screenshots -- --threshold 0.002
```

A GitHub Action (`.github/workflows/update-screenshots.yml`) runs this automatically
every Monday and opens a PR if any screenshots have changed.

## Releasing

Two jobs run on merge to `main`. Both are thin wrappers around a script in `scripts/`, so
anything they do can be run by hand if Actions is down or out of credits.

### Secrets

| Secret | Used by | Needs |
|---|---|---|
| `NPM_TOKEN` | `publish-npm.yml` | npm automation token with publish rights on the `astro-better-*` packages |
| `MIRROR_REPO_TOKEN` | `mirror-packages.yml` | GitHub token with `contents: write` on the sixteen `nathan-contino/*` target repos |

### Publishing to npm

`.github/workflows/publish-npm.yml` runs `scripts/publish-packages.mjs`, which publishes every
package whose `package.json` version is not already on the registry.

The check is against npm rather than a git diff, so it is idempotent: re-running after a partial
failure skips what already landed, a first publish needs no version bump to detect, and a squash
merge cannot hide the bump. Bumping a version is therefore the only thing required to release.

```shell-session
# what would publish
node scripts/publish-packages.mjs --dry-run

# publish by hand
NPM_TOKEN=... node scripts/publish-packages.mjs --no-provenance

# a single package
NPM_TOKEN=... node scripts/publish-packages.mjs --only astro-better-refs --no-provenance
```

Publishes from CI are signed with [npm provenance](https://docs.npmjs.com/generating-provenance-statements),
which is why the workflow grants `id-token: write` and why every `package.json` carries a
`repository` field pointing at this repo. Provenance only verifies from a CI runner, so pass
`--no-provenance` locally.

### Mirroring to the standalone repos

`.github/workflows/mirror-packages.yml` runs `scripts/mirror-packages.mjs`, which pushes each
changed directory to its own repo so every library stays individually cloneable. Targets come
from each directory's `repositoryUrl.txt`, which is also how the five renamed packages map onto
their original repo names.

The mirror is a full replacement: the target's contents are removed and replaced, `.github`
included, so it ends up an exact copy of the directory minus `repositoryUrl.txt`. Nothing is
pushed when the result is identical to what is already there.

```shell-session
# what would be mirrored where
node scripts/mirror-packages.mjs --dry-run --all

# mirror the directories a merge changed
MIRROR_REPO_TOKEN=... node scripts/mirror-packages.mjs --base HEAD~1

# mirror one directory
MIRROR_REPO_TOKEN=... node scripts/mirror-packages.mjs --only astro-better-refs
```

### Adding a package

1. Create the directory, with a `package.json` whose name starts with `astro-better-`.
2. Run `node scripts/normalize-package-metadata.mjs`, which fills in `repository`, `homepage`
   and `bugs`. Add a `files` allowlist for the new name to the `FILES` table in that script
   first, so publishing cannot pick up stray files.
3. Add a `repositoryUrl.txt` if it should be mirrored to a standalone repo.
4. Copy `LICENSE.md` in.

`node scripts/normalize-package-metadata.mjs --check` fails if any package is missing that
metadata, which makes it usable as a CI check.

### Renamed packages

Five packages took the `astro-better-` prefix and one (`generate-declarative-screenshots`) was
renamed to match. `rename-aliases/` holds a final version for each old name that depends on the
new package and re-exports it, so existing installs keep working:

```shell-session
node scripts/build-rename-aliases.mjs          # regenerate from the table in the script
node scripts/publish-rename-aliases.mjs --dry-run
NPM_TOKEN=... node scripts/publish-rename-aliases.mjs
```

That publishes each alias and runs `npm deprecate` on the old name so installs warn and point
at the replacement. It refuses to run until the replacement packages are on npm, since each
alias depends on one. This is deliberately not wired into a workflow: it runs once per rename.
Once every old name is published and deprecated, `rename-aliases/` and both rename scripts can
be deleted.

## Deployment

The site deploys to GitHub Pages automatically on every push to `main` via
`.github/workflows/deploy.yml`. The workflow:

1. Checks out the repo and installs Node (version from `.nvmrc`)
2. Runs `npm ci` to install deps
3. Runs `npm run build` to produce `dist/`
4. Uploads `dist/` as a Pages artifact and deploys it

To enable this for a new repo:

1. Go to Settings > Pages > Source and set it to "GitHub Actions"
2. Push to `main` -- the workflow triggers automatically

The deployed URL is `https://better-static-sites.github.io` (`site` in `astro.config.ts`, with
`base: '/'`).
