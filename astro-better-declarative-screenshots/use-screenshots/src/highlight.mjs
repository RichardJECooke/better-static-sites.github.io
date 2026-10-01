// injects visual highlights into a Playwright page before taking a screenshot.
// supports 'border' (colored outline), 'arrow' (pointer from outside), and 'both'.

/**
 * @typedef {Object} HighlightSpec
 * @property {string} selector
 * @property {'border'|'arrow'|'both'} style
 * @property {string} color
 * @property {string} label
 * @property {number} borderWidth
 */

/**
 * Inject highlight overlays into the page.
 * Returns a cleanup function that removes injected elements.
 *
 * @param {import('playwright').Page} page
 * @param {HighlightSpec[]} highlights
 * @returns {Promise<() => Promise<void>>} cleanup fn
 */
export async function injectHighlights(page, highlights) {
  if (!highlights.length) return async () => {};

  const ids = await page.evaluate((specs) => {
    const injectedIds = [];

    for (const spec of specs) {
      const target = document.querySelector(spec.selector);
      if (!target) {
        console.warn(`[screenshot] selector not found: ${spec.selector}`);
        continue;
      }

      const rect = target.getBoundingClientRect();

      // skip hidden/zero-size elements (e.g. hidden inputs inside a tokenizer widget)
      if (rect.width === 0 && rect.height === 0) {
        console.warn(`[screenshot] skipping zero-size element for selector: ${spec.selector}`);
        continue;
      }

      const scrollX = window.scrollX;
      const scrollY = window.scrollY;

      const top    = rect.top    + scrollY;
      const left   = rect.left   + scrollX;
      const width  = rect.width;
      const height = rect.height;

      const id = `__screenshot_hl_${Math.random().toString(36).slice(2)}`;
      injectedIds.push(id);

      if (spec.style === 'border' || spec.style === 'both') {
        const border = document.createElement('div');
        border.id = id + '_border';
        injectedIds.push(id + '_border');
        Object.assign(border.style, {
          position:      'absolute',
          top:           `${top - spec.borderWidth}px`,
          left:          `${left - spec.borderWidth}px`,
          width:         `${width  + spec.borderWidth * 2}px`,
          height:        `${height + spec.borderWidth * 2}px`,
          border:        `${spec.borderWidth}px solid ${spec.color}`,
          borderRadius:  '3px',
          pointerEvents: 'none',
          zIndex:        '99999',
          boxSizing:     'border-box',
        });
        document.documentElement.appendChild(border);
      }

      if (spec.style === 'arrow' || spec.style === 'both') {
        const arrowSize = 28;
        const arrowX = left - arrowSize - 6;
        const arrowY = top + height / 2 - arrowSize / 2;

        const arrow = document.createElement('div');
        arrow.id = id + '_arrow';
        injectedIds.push(id + '_arrow');
        // right-pointing triangle via SVG
        arrow.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="${arrowSize}" height="${arrowSize}" viewBox="0 0 24 24">
          <polygon points="4,4 20,12 4,20" fill="${spec.color}"/>
        </svg>`;
        Object.assign(arrow.style, {
          position:      'absolute',
          top:           `${arrowY}px`,
          left:          `${arrowX}px`,
          pointerEvents: 'none',
          zIndex:        '99999',
        });
        document.documentElement.appendChild(arrow);
      }

      if (spec.label) {
        const label = document.createElement('div');
        label.id = id + '_label';
        injectedIds.push(id + '_label');
        label.textContent = spec.label;
        Object.assign(label.style, {
          position:   'absolute',
          top:        `${top - 24}px`,
          left:       `${left}px`,
          background: spec.color,
          color:      '#fff',
          fontSize:   '12px',
          fontFamily: 'sans-serif',
          padding:    '2px 6px',
          borderRadius: '3px',
          pointerEvents: 'none',
          zIndex:     '99999',
          whiteSpace: 'nowrap',
        });
        document.documentElement.appendChild(label);
      }
    }

    return injectedIds;
  }, highlights);

  return async () => {
    await page.evaluate((injectedIds) => {
      for (const id of injectedIds) {
        const el = document.getElementById(id);
        if (el) el.remove();
      }
    }, ids);
  };
}

/**
 * Scroll an element into view before screenshotting.
 * @param {import('playwright').Page} page
 * @param {string} selector
 */
export async function scrollIntoView(page, selector) {
  await page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (el) el.scrollIntoView({ block: 'center' });
  }, selector);
}
