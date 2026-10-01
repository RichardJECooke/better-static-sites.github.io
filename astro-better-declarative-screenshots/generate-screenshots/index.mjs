// Astro integration entry point.
// usage in astro.config.mjs:
//   import screenshots from 'astro-better-generate-screenshots';
//   export default defineConfig({ integrations: [screenshots()] });

import { loadConfig } from 'astro-better-declarative-screenshots';
import path from 'path';

/**
 * @param {Partial<import('astro-better-declarative-screenshots').ConfigSchema['_type']>} [integrationConfig]
 * @returns {import('astro').AstroIntegration}
 */
export default function screenshotsIntegration(integrationConfig = {}) {
  let resolvedConfig;

  return {
    name: 'astro-better-declarative-screenshots',

    hooks: {
      'astro:config:setup': async ({ config: astroConfig, addWatchFile, logger }) => {
        const projectRoot = astroConfig.root
          ? new URL(astroConfig.root).pathname
          : process.cwd();

        // load and validate the screenshot.config.mjs
        try {
          resolvedConfig = await loadConfig(projectRoot);
        } catch (e) {
          if (integrationConfig.strict === false) {
            logger.warn(`[astro-better-declarative-screenshots] ${e.message}`);
            resolvedConfig = null;
          } else {
            throw e;
          }
        }

        // watch the config file so the dev server restarts when it changes
        const configFile = path.join(projectRoot, 'screenshot.config.mjs');
        addWatchFile(configFile);
      },

      'astro:build:done': async ({ logger }) => {
        if (!resolvedConfig) return;
        logger.info(
          '[astro-better-declarative-screenshots] build done. ' +
          'Run `take-screenshots` to update screenshots.'
        );
      },
    },
  };
}

// re-export utilities consumers may want
export { loadConfig, deriveName } from 'astro-better-declarative-screenshots';
export { discoverScreenshots } from './src/discover.mjs';
