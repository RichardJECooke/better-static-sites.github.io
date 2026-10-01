# astro-mermaid-renderer-cli-smol

> Renamed to [`astro-better-mermaid`](https://www.npmjs.com/package/astro-better-mermaid).

This package is deprecated. Version 0.1.2 is a thin re-export of
`astro-better-mermaid` so existing installs keep working, and it is the last
release under this name.

## Migrating

```
npm uninstall astro-mermaid-renderer-cli-smol
npm install astro-better-mermaid
```

Then update your imports:

```diff
-import x from 'astro-mermaid-renderer-cli-smol';
+import x from 'astro-better-mermaid';
```

Everything else is unchanged. See the [documentation](https://better-static-sites.github.io).
