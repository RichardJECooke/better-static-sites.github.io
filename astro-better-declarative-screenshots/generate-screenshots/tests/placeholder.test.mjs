import { describe, it, expect } from 'vitest';
import { generatePlaceholder } from '../src/placeholder.mjs';
import sharp from 'sharp';

describe('generatePlaceholder', () => {
  it('returns a Buffer', async () => {
    const buf = await generatePlaceholder({ name: 'test-screenshot' });
    expect(Buffer.isBuffer(buf)).toBe(true);
  });

  it('generates a valid PNG', async () => {
    const buf = await generatePlaceholder({ name: 'test' });
    const meta = await sharp(buf).metadata();
    expect(meta.format).toBe('png');
  });

  it('uses the specified dimensions', async () => {
    const buf = await generatePlaceholder({ name: 'test', width: 800, height: 600 });
    const meta = await sharp(buf).metadata();
    expect(meta.width).toBe(800);
    expect(meta.height).toBe(600);
  });

  it('defaults to 1280x800', async () => {
    const buf = await generatePlaceholder({ name: 'test' });
    const meta = await sharp(buf).metadata();
    expect(meta.width).toBe(1280);
    expect(meta.height).toBe(800);
  });

  it('handles names with special XML characters', async () => {
    // should not throw
    await expect(generatePlaceholder({ name: 'foo<bar>&baz' })).resolves.toBeTruthy();
  });
});
