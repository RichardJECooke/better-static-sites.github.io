import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadConfig } from '../src/config.mjs';
import { mkdirSync, writeFileSync, rmSync } from 'fs';
import path from 'path';
import os from 'os';

let tmpDir;

beforeEach(() => {
  tmpDir = path.join(os.tmpdir(), `config-test-${Math.random().toString(36).slice(2)}`);
  mkdirSync(tmpDir, { recursive: true });
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

function writeConfig(content) {
  writeFileSync(path.join(tmpDir, 'screenshot.config.mjs'), content);
}

describe('loadConfig', () => {
  it('throws when no config file exists', async () => {
    await expect(loadConfig(tmpDir)).rejects.toThrow(/No screenshot.config.mjs/);
  });

  it('loads a minimal valid config (no docker)', async () => {
    writeConfig(`
export default {
  baseUrl: 'http://localhost:9011',
};
`);
    const config = await loadConfig(tmpDir);
    expect(config.baseUrl).toBe('http://localhost:9011');
    expect(config.docker).toBeUndefined();
    // defaults applied
    expect(config.browser).toBe('webkit');
    expect(config.outputDir).toBe('./src/assets/screenshots');
    expect(config.colorScheme).toBe('light');
  });

  it('loads a config with docker settings', async () => {
    writeConfig(`
export default {
  baseUrl: 'http://localhost:9011',
  docker: {
    healthcheck: { url: 'http://localhost:9011/api/status' },
  },
};
`);
    const config = await loadConfig(tmpDir);
    expect(config.docker.healthcheck.url).toBe('http://localhost:9011/api/status');
  });

  it('applies window defaults', async () => {
    writeConfig(`export default { baseUrl: 'http://localhost:9011' };`);
    const config = await loadConfig(tmpDir);
    expect(config.window.width).toBe(1280);
    expect(config.window.height).toBe(800);
  });

  it('applies chrome defaults', async () => {
    writeConfig(`export default { baseUrl: 'http://localhost:9011' };`);
    const config = await loadConfig(tmpDir);
    expect(config.chrome.style).toBe('safari-macos');
    expect(config.chrome.showUrl).toBe(true);
    expect(config.chrome.shadowBlur).toBe(40);
  });

  it('accepts a custom outputDir', async () => {
    writeConfig(`
export default {
  baseUrl: 'http://localhost:9011',
  outputDir: 'public/screenshots',
};
`);
    const config = await loadConfig(tmpDir);
    expect(config.outputDir).toBe('public/screenshots');
  });

  it('rejects an invalid baseUrl', async () => {
    writeConfig(`export default { baseUrl: 'not-a-url' };`);
    await expect(loadConfig(tmpDir)).rejects.toThrow(/invalid/i);
  });

  it('accepts beforeScreenshot as a function', async () => {
    writeConfig(`
export default {
  baseUrl: 'http://localhost:9011',
  beforeScreenshot: async (page, spec) => {},
};
`);
    const config = await loadConfig(tmpDir);
    expect(typeof config.beforeScreenshot).toBe('function');
  });
});
