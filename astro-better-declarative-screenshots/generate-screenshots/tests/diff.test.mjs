import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { diffScreenshot } from '../src/diff.mjs';
import sharp from 'sharp';
import { writeFileSync, mkdirSync, rmSync } from 'fs';
import path from 'path';
import os from 'os';

let tmpDir;

beforeEach(() => {
  tmpDir = path.join(os.tmpdir(), `diff-test-${Math.random().toString(36).slice(2)}`);
  mkdirSync(tmpDir, { recursive: true });
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

async function makeImage(r, g, b, width = 50, height = 50) {
  return sharp({
    create: { width, height, channels: 3, background: { r, g, b } },
  }).png().toBuffer();
}

describe('diffScreenshot', () => {
  it('returns ratio=1 when reference file is missing', async () => {
    const newBuf = await makeImage(200, 200, 200);
    const result = await diffScreenshot('/nonexistent/path.png', newBuf);
    expect(result.pixels).toBe(-1);
    expect(result.ratio).toBe(1);
  });

  it('returns ratio=0 for identical images', async () => {
    const buf = await makeImage(128, 128, 128);
    const refPath = path.join(tmpDir, 'ref.png');
    writeFileSync(refPath, buf);

    const result = await diffScreenshot(refPath, buf);
    expect(result.ratio).toBe(0);
    expect(result.pixels).toBe(0);
  });

  it('detects pixel differences between different-colored images', async () => {
    const ref = await makeImage(0, 0, 0);
    const newer = await makeImage(255, 255, 255);
    const refPath = path.join(tmpDir, 'ref.png');
    writeFileSync(refPath, ref);

    const result = await diffScreenshot(refPath, newer, { threshold: 0.1 });
    expect(result.pixels).toBeGreaterThan(0);
    expect(result.ratio).toBeGreaterThan(0);
  });

  it('returns null diffImage when writeDiff is false', async () => {
    const ref = await makeImage(0, 0, 0);
    const refPath = path.join(tmpDir, 'ref.png');
    writeFileSync(refPath, ref);

    const result = await diffScreenshot(refPath, ref, { writeDiff: false });
    expect(result.diffImage).toBeNull();
  });

  it('returns a diffImage buffer when writeDiff is true and images differ', async () => {
    const ref = await makeImage(0, 0, 0);
    const newer = await makeImage(255, 0, 0);
    const refPath = path.join(tmpDir, 'ref.png');
    writeFileSync(refPath, ref);

    const result = await diffScreenshot(refPath, newer, { writeDiff: true, threshold: 0.1 });
    expect(Buffer.isBuffer(result.diffImage)).toBe(true);
    // the diff image should be a valid PNG
    const meta = await sharp(result.diffImage).metadata();
    expect(meta.format).toBe('png');
  });

  it('returns ratio=1 for images of different dimensions', async () => {
    const ref = await makeImage(0, 0, 0, 100, 100);
    const newer = await makeImage(0, 0, 0, 200, 200);
    const refPath = path.join(tmpDir, 'ref.png');
    writeFileSync(refPath, ref);

    const result = await diffScreenshot(refPath, newer);
    expect(result.ratio).toBe(1);
  });
});
