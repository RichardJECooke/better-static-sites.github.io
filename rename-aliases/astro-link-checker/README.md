# astro-link-checker

> Renamed to [`astro-better-link-checker`](https://www.npmjs.com/package/astro-better-link-checker).

This package is deprecated. Version 1.0.1 is a thin re-export of
`astro-better-link-checker` so existing installs keep working, and it is the last
release under this name.

## Migrating

```
npm uninstall astro-link-checker
npm install astro-better-link-checker
```

Then update your imports:

```diff
-import x from 'astro-link-checker';
+import x from 'astro-better-link-checker';
```

Everything else is unchanged. See the [documentation](https://better-static-sites.github.io).
