// generates a placeholder PNG for a screenshot that has not yet been taken.
// the placeholder is gray with white centered text showing the filename.
// sharp is used so the placeholder is a real PNG, not a data URI.

import sharp from 'sharp';

/**
 * @param {object} opts
 * @param {string} opts.name - screenshot name (without extension), shown as label
 * @param {number} [opts.width=1280]
 * @param {number} [opts.height=800]
 * @returns {Promise<Buffer>} PNG buffer
 */
export async function generatePlaceholder({ name, width = 1280, height = 800 }) {
  const label = name + '.png';
  const fontSize = Math.min(20, Math.floor(width / 40));

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <rect width="${width}" height="${height}" fill="#e8e8e8"/>
    <line x1="0" y1="0" x2="${width}" y2="${height}" stroke="#ccc" stroke-width="1"/>
    <line x1="${width}" y1="0" x2="0" y2="${height}" stroke="#ccc" stroke-width="1"/>
    <rect x="${width / 2 - 200}" y="${height / 2 - 40}" width="400" height="80" rx="8" fill="white" opacity="0.8"/>
    <text
      x="${width / 2}"
      y="${height / 2 - 6}"
      text-anchor="middle"
      dominant-baseline="middle"
      font-family="sans-serif"
      font-size="${fontSize}"
      fill="#666"
    >Screenshot not generated</text>
    <text
      x="${width / 2}"
      y="${height / 2 + fontSize + 4}"
      text-anchor="middle"
      dominant-baseline="middle"
      font-family="monospace"
      font-size="${Math.max(10, fontSize - 4)}"
      fill="#999"
    >${escapeXml(label)}</text>
  </svg>`;

  return sharp(Buffer.from(svg)).png().toBuffer();
}

function escapeXml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
