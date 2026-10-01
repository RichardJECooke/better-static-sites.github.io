# astro-toc-smol

> Renamed to [`astro-better-toc`](https://www.npmjs.com/package/astro-better-toc).

This package is deprecated. Version 1.1.3 is a thin re-export of
`astro-better-toc` so existing installs keep working, and it is the last
release under this name.

## Migrating

```
npm uninstall astro-toc-smol
npm install astro-better-toc
```

Then update your imports:

```diff
-import x from 'astro-toc-smol';
+import x from 'astro-better-toc';
```

Everything else is unchanged. See the [documentation](https://better-static-sites.github.io).
