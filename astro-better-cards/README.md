# astro-better-cards

Components for cards and navigation in Astro documentation sites.

## Card

A single card with three display variants.

```astro
import Card from 'astro-better-cards/Card.astro';

<Card
  href="/docs/section/page"
  title="Page Title"
  description="Optional description text."
  icon="/img/icons/example.svg"
  variant="full"
/>
```

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `href` | `string` | required | Link destination |
| `title` | `string` | required | Card title (HTML allowed) |
| `description` | `string` | — | Subtitle text |
| `icon` | `string` | — | Icon image URL (light mode) |
| `darkIcon` | `string` | — | Icon image URL (dark mode) |
| `cardImage` | `string` | — | Hero image URL |
| `variant` | `'full' \| 'compact' \| 'quickstart'` | `'full'` | Display style |
| `comingSoon` | `boolean` | `false` | Greys out the card |
| `label` | `string` | — | Small label text |
| `labelFirst` | `boolean` | `false` | Render label before title |
| `version` | `string` | — | Version string shown below the title |
| `badges` | `string[]` | — | Badge labels shown beside the version |

## ChildCards

Automatically renders cards for child pages of the current section, pulled from an Astro content collection.

```astro
import ChildCards from 'astro-better-cards/ChildCards.astro';

<!-- direct children of the current page's folder -->
<ChildCards />

<!-- grandchildren grouped by subfolder with section headers -->
<ChildCards depth={2} />

<!-- deeper nesting (up to 4) with h2/h3/h4 section headers -->
<ChildCards depth={4} />

<!-- explicit folder, 3 columns -->
<ChildCards folder="get-started/quickstarts" columns={3} />

<!-- children from a different collection -->
<ChildCards collection="articles" />
```

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `collection` | `string` | `'docs'` | Astro content collection name |
| `folder` | `string` | current page folder | Collection-relative path (`get-started/foo`), URL-absolute path (`/docs/get-started/foo`), or relative path (`./sub`, `../other`) |
| `depth` | `1 \| 2 \| 3 \| 4` | `1` | `1` = direct children; `2`-`4` = deeper pages grouped under section headers (h2, then h3, then h4) |
| `columns` | `1 \| 2 \| 3 \| 4` | `2` | Number of columns in the card grid |

Pages with `excludeFromNav: true` or `route: false` are excluded.

## PageNav

Renders previous/next navigation links at the bottom of a page. Reads `prev` and `next` from the
current page's frontmatter and resolves titles automatically from the collection. Prop values
override frontmatter when both are present.

Add `prev` and `next` to the page's frontmatter:

```yaml
prev: "step-1"
next: "step-3"
```

Then use the component with no props:

```astro
import PageNav from 'astro-better-cards/PageNav.astro';

<PageNav />
```

Or override frontmatter on a specific instance:

```astro
<PageNav prev="other-page" next="another-page" />
```

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `collection` | `string` | `'docs'` | Astro content collection name |
| `prev` | `string` | frontmatter `prev` | Path to the previous page (relative filename, collection-relative, or absolute `/`) |
| `next` | `string` | frontmatter `next` | Path to the next page |
