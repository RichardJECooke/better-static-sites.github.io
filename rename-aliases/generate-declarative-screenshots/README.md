# generate-declarative-screenshots

> Renamed to [`astro-better-generate-screenshots`](https://www.npmjs.com/package/astro-better-generate-screenshots).

This package is deprecated. Version 0.4.3 is a thin re-export of
`astro-better-generate-screenshots` so existing installs keep working, and it is the last
release under this name.

## Migrating

```
npm uninstall generate-declarative-screenshots
npm install astro-better-generate-screenshots
```

Then update your imports:

```diff
-import x from 'generate-declarative-screenshots';
+import x from 'astro-better-generate-screenshots';
```

Everything else is unchanged. See the [documentation](https://better-static-sites.github.io).
