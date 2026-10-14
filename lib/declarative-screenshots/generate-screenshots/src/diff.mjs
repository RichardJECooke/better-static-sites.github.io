// pixel-level diff between an existing screenshot and a newly captured one.
// used by check-screenshots to detect visual regressions in CI.

import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';
import { readFileSync } from 'fs';
import sharp from 'sharp';

/**
 * @typedef {Object} DiffResult
 * @property {number} pixels - total number of differing pixels
 * @property {number} ratio - differing pixels / total pixels (0..1)
 * @property {Buffer|null} diffImage - PNG buffer visualizing the diff, or null if identical
 */

/**
 * Compare a newly captured PNG buffer against the on-disk reference file.
 *
 * @param {string} referencePath - absolute path to the reference PNG
 * @param {Buffer} newBuffer - PNG buffer from a fresh capture
 * @param {object} [opts]
 * @param {number} [opts.threshold=0.1] - pixelmatch threshold (0 = strict, 1 = lenient)
 * @param {boolean} [opts.writeDiff=false] - include the diff image buffer in the result
 * @returns {Promise<DiffResult>}
 */
export async function diffScreenshot(referencePath, newBuffer, opts = {}) {
  const { threshold = 0.1, writeDiff = false } = opts;

  let refBuffer;
  try {
    refBuffer = readFileSync(referencePath);
  } catch {
    // reference doesn't exist -- treat as fully different
    return { pixels: -1, ratio: 1, diffImage: null };
  }

  // normalize both images to the same dimensions before diffing
  const [refNorm, newNorm] = await Promise.all([
    normalizeSize(refBuffer),
    normalizeSize(newBuffer),
  ]);

  const refPng = PNG.sync.read(refNorm);
  const newPng = PNG.sync.read(newNorm);

  // if dimensions differ after normalization, sizes changed -- treat as fully different
  if (refPng.width !== newPng.width || refPng.height !== newPng.height) {
    return {
      pixels: refPng.width * refPng.height,
      ratio: 1,
      diffImage: null,
    };
  }

  const { width, height } = refPng;
  const totalPixels = width * height;
  const diffPng = writeDiff ? new PNG({ width, height }) : null;

  const diffPixels = pixelmatch(
    refPng.data,
    newPng.data,
    diffPng?.data ?? null,
    width,
    height,
    { threshold }
  );

  const diffImage = diffPng ? PNG.sync.write(diffPng) : null;

  return {
    pixels: diffPixels,
    ratio: diffPixels / totalPixels,
    diffImage,
  };
}

async function normalizeSize(buffer) {
  // re-encode via sharp to ensure consistent PNG format and strip metadata
  return sharp(buffer).png().toBuffer();
}
