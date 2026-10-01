# astro-refs

> Renamed to [`astro-better-refs`](https://www.npmjs.com/package/astro-better-refs).

This package is deprecated. Version 0.1.2 is a thin re-export of
`astro-better-refs` so existing installs keep working, and it is the last
release under this name.

## Migrating

```
npm uninstall astro-refs
npm install astro-better-refs
```

Then update your imports:

```diff
-import x from 'astro-refs';
+import x from 'astro-better-refs';
```

Everything else is unchanged. See the [documentation](https://better-static-sites.github.io).
