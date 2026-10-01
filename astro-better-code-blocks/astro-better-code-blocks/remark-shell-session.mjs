/**
 * Remark plugin that normalizes shell-session code blocks.
 * Lines without a prompt prefix get "$ " prepended so Prism's shell-session
 * grammar can tokenize and style them correctly.
 *
 * Only runs at build time -- no client-side script involved.
 * The copy button skips prompt tokens via data-no-copy (set by rehypeCodeBlocks).
 */

import { visit } from 'unist-util-visit';

/**
 * @param {object} [opts]
 * @param {string} [opts.prompt='$ '] - default prompt to prepend to unprompted lines
 */
export function remarkShellSession({ prompt = '$ ' } = {}) {
  return (tree) => {
    visit(tree, 'code', (node) => {
      if (node.lang !== 'shell-session') return;

      const lines = node.value.split('\n');
      let continuation = false;
      let openQuote = false;

      node.value = lines.map(line => {
        // empty lines reset all state
        if (!line.trim()) {
          continuation = false;
          openQuote = false;
          return line;
        }

        const isContinuation = continuation || openQuote;

        // update state from this line's content
        const endsWithBackslash = line.trimEnd().endsWith('\\');
        // count unescaped single quotes to track whether a quoted argument spans lines
        const quoteCount = (line.match(/'/g) || []).length;
        openQuote = openQuote !== (quoteCount % 2 === 1);
        continuation = endsWithBackslash;

        if (isContinuation) return line;
        if (line.startsWith('$ ') || line.startsWith('# ')) return line;
        return prompt + line;
      }).join('\n');
    });
  };
}
