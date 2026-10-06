/**
 * Sidebar tree building, shared across every page of a build.
 *
 * The tree only depends on the collection and the sidebar options, so it is
 * built and sorted once per distinct input. Each page then gets a view that
 * copies just the nodes on its active path, with the open/active flags set.
 */

import { Marked } from 'marked';

const marked = new Marked();
const titleHtmlCache = new Map();

/** Inline-markdown title HTML, parsed once per distinct title. */
export function titleHtml(title) {
  let html = titleHtmlCache.get(title);
  if (html === undefined) {
    html = marked.parseInline(title);
    titleHtmlCache.set(title, html);
  }
  return html;
}

export function normalizeForMatch(p, basePath) {
  if (!p) return "";
  let clean = decodeURI(p);
  if (clean.startsWith(basePath)) clean = clean.substring(basePath.length);
  return clean.replace(/\.(md|mdx|html)$/i, '').replace(/\/index$/i, '').replace(/^\/+|\/+$/g, '');
}

const formatTitle = (str) => str.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

function buildTree(pages, { basePath, folderBehavior, overviewLabel }) {
  const root = { children: {}, title: 'Documentation', href: basePath, order: -1 };
  for (const page of pages) {
    const { order, hidden, title: dataTitle } = page.data;
    const label = page.data?.sidebar?.label;
    const pageFolderBehavior = page.data?.sidebar?.folderBehavior;
    if (hidden === true) continue;

    const slug = page.slug || page.id || "";
    const parts = slug.split('/');
    let current = root;

    if (slug === "index" || slug === "") {
      root.title = label || dataTitle || root.title;
      if (order !== undefined) root.order = order;
      continue;
    }

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];

      if (part === 'index') {
        const effective = pageFolderBehavior || folderBehavior;

        current.title = label || dataTitle || current.title;
        if (order !== undefined) current.order = order;

        // route: false pages still contribute title/order but produce no link
        if (page.data?.route !== false) {
          const href = `${basePath}/${slug.replace(/\/index$/, "")}`.replace(/\/+/g, '/').replace(/\/$/, "");
          if (effective === 'page') {
            current.href = href;
          } else if (effective === 'overview') {
            // inject a synthetic first child that links to the index page
            current.children['__sidebar_overview__'] = {
              name: '__sidebar_overview__',
              title: overviewLabel,
              href,
              children: {},
              sortedChildren: [],
              isOpen: false,
              isActive: false,
              order: -Infinity,
            };
          }
          // 'unclickable': no href set, no overview child
        }
        break;
      }

      if (!current.children[part]) {
        current.children[part] = {
          name: part,
          title: formatTitle(part),
          href: null,
          children: {},
          isOpen: false,
          isActive: false,
          order: Infinity,
        };
      }

      if (i === parts.length - 1) {
        current.children[part].title = label || dataTitle || formatTitle(part);
        current.children[part].href = `${basePath}/${slug.replace(/\.(md|mdx)$/i, '')}`.replace(/\/+/g, '/').replace(/\/$/, "");
        if (order !== undefined) current.children[part].order = order;
      }
      current = current.children[part];
    }
  }
  return root;
}

function getSortedArray(nodeChildren) {
  const arr = Object.values(nodeChildren);
  arr.sort((a, b) => {
    const vA = a.order === undefined ? Infinity : a.order;
    const vB = b.order === undefined ? Infinity : b.order;
    return vA !== vB ? vA - vB : a.title.localeCompare(b.title);
  });
  arr.forEach(child => {
    child.sortedChildren = child.children && Object.keys(child.children).length > 0 ? getSortedArray(child.children) : [];
  });
  return arr;
}

// Everything buildTree reads, so equal keys always build equal trees.
function cacheKey(pages, opts) {
  const parts = [JSON.stringify([opts.basePath, opts.folderBehavior, opts.overviewLabel])];
  for (const page of pages) {
    const d = page.data ?? {};
    parts.push(JSON.stringify([page.slug, page.id, d.order, d.hidden, d.title, d.sidebar?.label, d.sidebar?.folderBehavior, d.route]));
  }
  return parts.join('\n');
}

// dev servers rebuild on every content change; keep only recent trees
const MAX_CACHED_TREES = 8;
const cache = new Map();

function cachedTree(pages, opts) {
  const key = cacheKey(pages, opts);
  let entry = cache.get(key);
  if (entry) return entry;

  const root = buildTree(pages, opts);
  const nodes = getSortedArray(root.children);

  // flags start false; each page's view flips them along its active path
  const parents = new Map();
  const byHref = new Map();
  const index = (list, parent) => {
    for (const node of list) {
      node.isCurrentPage = false;
      node.isActive = false;
      node.isOpen = false;
      node.htmlTitle = titleHtml(node.title);
      if (parent) parents.set(node, parent);
      if (node.href != null) {
        const match = normalizeForMatch(node.href, opts.basePath);
        if (!byHref.has(match)) byHref.set(match, []);
        byHref.get(match).push(node);
      }
      index(node.sortedChildren, node);
    }
  };
  index(nodes, null);

  entry = { nodes, parents, byHref };
  cache.set(key, entry);
  if (cache.size > MAX_CACHED_TREES) cache.delete(cache.keys().next().value);
  return entry;
}

/**
 * Sorted top-level sidebar nodes for one page, with isCurrentPage, isActive,
 * and isOpen set as they would be on a freshly built tree. Shared nodes are
 * never mutated; nodes on the active path are copies.
 */
export function sidebarFor(pages, opts, pathname) {
  const { nodes, parents, byHref } = cachedTree(pages, opts);
  const current = new Set(byHref.get(normalizeForMatch(pathname, opts.basePath)) ?? []);
  if (current.size === 0) return nodes;

  const active = new Set();
  for (const node of current) {
    for (let n = node; n && !active.has(n); n = parents.get(n)) active.add(n);
  }

  const view = (list) => list.map(node => active.has(node)
    ? { ...node, isCurrentPage: current.has(node), isActive: true, isOpen: true, sortedChildren: view(node.sortedChildren) }
    : node);
  return view(nodes);
}
