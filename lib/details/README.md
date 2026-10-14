# astro-better-details

Expandable `<details>` / `<summary>` disclosure component for Astro MDX. No JavaScript required -- the browser handles expand/collapse natively. The chevron animates with CSS.

## Installation

```shell
npm install astro-better-details
```

## Basic usage

Pass a plain string via the `title` prop:

```mdx
import Details from 'astro-better-details/Details.astro';

<Details title="What is this?">
  This is the expanded content. It can contain any Markdown or MDX.
</Details>
```

Use the `title` slot when the header needs inline markup -- code, links, or components:

```mdx
<Details>
  <span slot="title">Why use <code>astro-better-details</code>?</span>
  This is the expanded content. It can contain any Markdown or MDX.
</Details>
```

The `title` slot takes precedence over the `title` prop if both are provided. The default slot holds the body content shown when expanded.

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `title` | `string` | -- | Plain-text header label; use the `title` slot for inline markup |
| `open` | `boolean` | `false` | Render the component already expanded |
| `class` | `string` | -- | Additional CSS class(es) applied to the `<details>` element |

## Slots

| Slot | Description |
|------|-------------|
| `title` (named) | Header content with inline markup; takes precedence over the `title` prop |
| default | Body content, shown when expanded |

## Theming

The component uses CSS custom properties for all visual values. Override them on `.abt-details` or any parent selector to match your brand:

| Property | Default | Controls |
|----------|---------|----------|
| `--abt-details-border` | `#d1d5db` | Border color around the whole component and between summary/body |
| `--abt-details-summary-bg` | `#f9fafb` | Background of the summary bar |
| `--abt-details-chevron` | `#9ca3af` | Chevron icon color |

Example -- purple light mode, orange dark mode to match a common docs site palette:

```css
.abt-details {
  --abt-details-border:     #ddd6fe;
  --abt-details-summary-bg: #f5f3ff;
  --abt-details-chevron:    #7c3aed;
}

.dark .abt-details {
  --abt-details-border:     #1c0e00;
  --abt-details-summary-bg: #0f0f0f;
  --abt-details-chevron:    #fb923c;
}
```

If your project uses a `data-theme` attribute instead of a `.dark` class, adjust the selector accordingly.

## Code blocks inside Details

The body slot renders its content as raw HTML. Code block titles (the `title="..."` meta from `astro-better-code-blocks`) render correctly because that package's CSS targets `.code-figure` globally. Do not add a `.prose` class to the body if you use Tailwind Typography -- the typography plugin styles `<figcaption>` as italic, which would override the `font-style: normal` on code titles.

If your site needs prose-style typography inside the body, apply it via a wrapper element inside the slot rather than on the component itself:

```mdx
<Details>
  <span slot="title">Example</span>
  <div class="prose">
    Content here gets prose styling.
  </div>
</Details>
```

## Accessibility

The component renders a native `<details>` / `<summary>` element pair. Screen readers expose this as a disclosure widget with the summary as the interactive label. No ARIA attributes need to be added manually.
