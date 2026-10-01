# astro-better-generate-screenshots

CLI that generates the screenshot PNGs consumed by astro-better-declarative-screenshots.

## Install

```sh
npm install astro-better-generate-screenshots
```

## What it does

- Starts Docker and captures pages with Playwright WebKit
- Injects highlights and composites window chrome
- Diffs against committed PNGs to detect drift

## Documentation

Full documentation, including configuration and examples, is at
[https://better-static-sites.github.io/content/declarative-screenshots](https://better-static-sites.github.io/content/declarative-screenshots).

This package is published from the [Better Static Sites monorepo](https://github.com/better-static-sites/better-static-sites.github.io); the directory it lives in has a combined README covering it and its sibling package.
