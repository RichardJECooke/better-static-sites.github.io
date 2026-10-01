import { describe, it, expect } from 'vitest';
import { addChrome } from '../src/chrome.mjs';
import sharp from 'sharp';

// create a minimal 100x80 solid-color PNG to use as the page content
async function makeTestImage(width = 100, height = 80) {
  return sharp({
    create: { width, height, channels: 3, background: { r: 200, g: 220, b: 240 } },
  }).png().toBuffer();
}

describe('addChrome', () => {
  it('returns a Buffer', async () => {
    const page = await makeTestImage();
    const result = await addChrome(page);
    expect(Buffer.isBuffer(result)).toBe(true);
  });

  it('produces a valid PNG', async () => {
    const page = await makeTestImage();
    const result = await addChrome(page);
    const meta = await sharp(result).metadata();
    expect(meta.format).toBe('png');
  });

  it('output is taller than the input (chrome was added)', async () => {
    const page = await makeTestImage(100, 80);
    const result = await addChrome(page, { shadowBlur: 0 });
    const meta = await sharp(result).metadata();
    expect(meta.height).toBeGreaterThan(80);
  });

  it('output is wider with shadow padding', async () => {
    const page = await makeTestImage(100, 80);
    const resultWithShadow = await addChrome(page, { shadowBlur: 20, shadowPadding: 30 });
    const resultNoShadow = await addChrome(page, { shadowBlur: 0 });
    const metaWithShadow = await sharp(resultWithShadow).metadata();
    const metaNoShadow = await sharp(resultNoShadow).metadata();
    expect(metaWithShadow.width).toBeGreaterThan(metaNoShadow.width);
  });

  it('showUrl: false produces a shorter output than showUrl: true', async () => {
    const page = await makeTestImage(100, 80);
    const withUrl = await addChrome(page, { shadowBlur: 0, showUrl: true });
    const withoutUrl = await addChrome(page, { shadowBlur: 0, showUrl: false });
    const metaWith = await sharp(withUrl).metadata();
    const metaWithout = await sharp(withoutUrl).metadata();
    expect(metaWith.height).toBeGreaterThan(metaWithout.height);
  });

  it('does not error with a long URL', async () => {
    const page = await makeTestImage();
    const longUrl = 'http://localhost:9011/' + 'a'.repeat(200);
    await expect(addChrome(page, { url: longUrl })).resolves.toBeTruthy();
  });

  it('dark option does not throw', async () => {
    const page = await makeTestImage();
    await expect(addChrome(page, { dark: true })).resolves.toBeTruthy();
  });
});
