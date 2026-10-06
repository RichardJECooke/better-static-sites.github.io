/**
 * sidebarFor must return what the original per-page Sidebar.astro frontmatter
 * built, for every page. `original` below is that frontmatter, verbatim apart
 * from type annotations.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sidebarFor } from '../tree.js';

function original(collection, { basePath, folderBehavior = 'page', overviewLabel = 'Overview' }, pathname) {
  const normalizeForMatch = (p) => {
    if (!p) return "";
    let clean = decodeURI(p);
    if (clean.startsWith(basePath)) clean = clean.substring(basePath.length);
    return clean.replace(/\.(md|mdx|html)$/i, '').replace(/\/index$/i, '').replace(/^\/+|\/+$/g, '');
  };

  const safeCurrentPath = normalizeForMatch(pathname);
  const formatTitle = (str) => str.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

  function buildTree(pages) {
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

  const treeRoot = buildTree(collection);

  function markActiveAndOpen(node) {
    node.isCurrentPage = node.href != null && normalizeForMatch(node.href) === safeCurrentPath;
    let hasActiveChild = false;
    for (const key in node.children) {
      if (markActiveAndOpen(node.children[key])) hasActiveChild = true;
    }
    node.isActive = node.isCurrentPage || hasActiveChild;
    node.isOpen = node.isActive;
    return node.isActive;
  }

  markActiveAndOpen(treeRoot);

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

  const treeArray = getSortedArray(treeRoot.children);
  return treeArray;
}

// flags and structure only; htmlTitle is added by the cache
function shape(nodes) {
  return nodes.map(n => ({
    title: n.title, href: n.href, order: n.order,
    isCurrentPage: !!n.isCurrentPage, isActive: n.isActive, isOpen: n.isOpen,
    children: shape(n.sortedChildren ?? []),
  }));
}

const page = (id, data = {}) => ({ id, data: { title: id.split('/').pop(), ...data } });
const COLLECTION = [
  page('index', { title: 'Docs Home', order: 0 }),
  page('get-started/index', { title: 'Get Started', order: 1 }),
  page('get-started/install', { order: 2 }),
  page('get-started/configure', { order: 1, sidebar: { label: 'Configure **it**' } }),
  page('apis/index', { title: 'APIs', sidebar: { folderBehavior: 'overview' } }),
  page('apis/users'),
  page('apis/groups'),
  page('apis/deep/nested/thing'),
  page('apis/deep/nested/index', { title: 'Nested' }),
  page('guides/index', { title: 'Guides', sidebar: { folderBehavior: 'unclickable' } }),
  page('guides/one'),
  page('guides/two', { hidden: true }),
  page('extend/index', { title: 'Extend', route: false }),
  page('extend/plugins'),
  page('a-b-c/x-y'),
];

for (const opts of [
  { basePath: '/docs' },
  { basePath: '/docs', folderBehavior: 'overview', overviewLabel: 'Start here' },
  { basePath: '/articles', folderBehavior: 'unclickable' },
]) {
  test(`matches the original for every page (${JSON.stringify(opts)})`, () => {
    const full = { folderBehavior: 'page', overviewLabel: 'Overview', ...opts };
    const paths = [
      ...COLLECTION.map(p => `${opts.basePath}/${p.id.replace(/\/index$/, '')}/`),
      `${opts.basePath}/`, `${opts.basePath}/nope/`, '/elsewhere/',
    ];
    for (const pathname of [...paths, ...paths]) {
      assert.deepEqual(shape(sidebarFor(COLLECTION, full, pathname)), shape(original(COLLECTION, opts, pathname)), pathname);
    }
  });
}

test('cached nodes are not mutated by a page view', () => {
  const opts = { basePath: '/docs', folderBehavior: 'page', overviewLabel: 'Overview' };
  const before = JSON.stringify(shape(sidebarFor(COLLECTION, opts, '/nope/')));
  sidebarFor(COLLECTION, opts, '/docs/apis/deep/nested/thing/');
  assert.equal(JSON.stringify(shape(sidebarFor(COLLECTION, opts, '/nope/'))), before);
});

test('a changed collection builds a new tree', () => {
  const opts = { basePath: '/docs', folderBehavior: 'page', overviewLabel: 'Overview' };
  const renamed = COLLECTION.map(p => p.id === 'apis/users' ? page('apis/users', { title: 'People' }) : p);
  const titles = (nodes) => JSON.stringify(shape(nodes)).match(/"title":"[^"]*"/g);
  assert.ok(titles(sidebarFor(renamed, opts, '/x/')).includes('"title":"People"'));
  assert.ok(!titles(sidebarFor(COLLECTION, opts, '/x/')).includes('"title":"People"'));
});
