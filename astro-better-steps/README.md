# astro-better-steps

Numbered step-by-step component for Astro. Wraps an ordered list with auto-numbered circular badges and a vertical connector line between steps. No Tailwind required.

## Installation

```
npm install astro-better-steps
```

Import the stylesheet once in your root layout:

```astro
---
import 'astro-better-steps/style.css';
---
```

## Usage

Wrap any `<ol>` with `<Steps>`. The component uses CSS counters to number each `<li>` automatically.

```astro
---
import { Steps } from 'astro-better-steps';
---

<Steps>
  <ol>
    <li>Install the dependencies.</li>
    <li>Configure your environment variables.</li>
    <li>Start the development server.</li>
  </ol>
</Steps>
```

Each `<li>` can contain any content including headings, code blocks, and nested lists.

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `class` | `string` | `''` | Extra CSS classes on the wrapper element |

## Dark mode

The stylesheet uses a `.dark` ancestor class (compatible with Tailwind's `darkMode: 'class'`). When `.dark` is present on `<html>` or any ancestor, the step badges switch to indigo dark mode colors.

No `@media (prefers-color-scheme: dark)` rules are included. If your project needs OS-based dark mode without a class toggle, add this to your project CSS:

```css
@media (prefers-color-scheme: dark) {
  html:not([data-theme="light"]) {
    /* .dark rules are applied by JS in most Tailwind setups */
  }
}
```
