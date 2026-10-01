// Playwright-based page capture. opens the page, runs beforeScreenshot hooks,
// injects highlights, takes the screenshot, then cleans up.

import { chromium, firefox, webkit } from 'playwright';
import { injectHighlights, scrollIntoView } from 'astro-better-declarative-screenshots';

const BROWSERS = { webkit, chromium, firefox };

/**
 * @typedef {Object} CaptureOptions
 * @property {string} url - full URL including host
 * @property {string} name - screenshot name (for logging)
 * @property {Array<import('astro-better-declarative-screenshots').HighlightSpec>} highlights
 * @property {number} [width=1280]
 * @property {number} [height=800]
 * @property {boolean} [fullPage=false]
 * @property {'webkit'|'chromium'|'firefox'} [browser='webkit']
 * @property {'light'|'dark'} [colorScheme='light']
 * @property {Function} [beforeScreenshot]
 * @property {import('playwright').BrowserContext} [context] - reuse an existing context
 */

/**
 * Capture a single screenshot and return the PNG buffer.
 *
 * @param {CaptureOptions} opts
 * @returns {Promise<Buffer>}
 */
export async function capturePage(opts) {
  const {
    url,
    name,
    highlights = [],
    width = 1280,
    height = 800,
    fullPage = false,
    browser: browserName = 'webkit',
    colorScheme = 'light',
    beforeScreenshot,
    context: existingContext,
  } = opts;

  let browser;
  let context = existingContext;
  let page;

  try {
    if (!context) {
      browser = await BROWSERS[browserName].launch({ headless: true });
      context = await browser.newContext({
        viewport: { width, height },
        colorScheme,
        deviceScaleFactor: 2,
      });
    }

    page = await context.newPage();
    await page.setViewportSize({ width, height });

    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });

    if (beforeScreenshot) {
      await beforeScreenshot(page, { url, name, highlights });
    }

    if (fullPage) {
      // full-page captures render from y=0; scrolling first would displace sticky/fixed elements
      await page.evaluate(() => window.scrollTo(0, 0));
    } else if (highlights.length > 0 && highlights[0].selector) {
      await scrollIntoView(page, highlights[0].selector).catch(() => {});
    }

    const cleanup = await injectHighlights(page, highlights);

    // small pause to let any CSS transitions finish after highlight injection
    await page.waitForTimeout(150);

    const buffer = await page.screenshot({
      type: 'png',
      fullPage,
      animations: 'disabled',
    });

    await cleanup();
    await page.close();

    return buffer;
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
}

/**
 * Create a persistent browser context for taking multiple screenshots.
 * Caller is responsible for calling context.close() when done.
 *
 * @param {object} opts
 * @param {'webkit'|'chromium'|'firefox'} [opts.browser='webkit']
 * @param {number} [opts.width=1280]
 * @param {number} [opts.height=800]
 * @param {'light'|'dark'} [opts.colorScheme='light']
 * @returns {Promise<{browser: import('playwright').Browser, context: import('playwright').BrowserContext}>}
 */
export async function createBrowserContext({ browser: browserName = 'webkit', width = 1280, height = 800, colorScheme = 'light' } = {}) {
  const browser = await BROWSERS[browserName].launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width, height },
    colorScheme,
    deviceScaleFactor: 2,
  });
  return { browser, context };
}
