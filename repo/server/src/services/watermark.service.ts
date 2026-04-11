import sharp from 'sharp';
import path from 'path';

export interface WatermarkOptions {
  text: string;
  fontSize?: number;
  opacity?: number;
  color?: string;
  position?: 'center' | 'bottom-right' | 'bottom-left';
}

/**
 * Apply a text watermark overlay to an image buffer using sharp.
 * Returns the watermarked image buffer.
 */
export async function applyWatermark(
  inputBuffer: Buffer,
  options: WatermarkOptions
): Promise<Buffer> {
  const {
    text,
    fontSize = 48,
    opacity = 0.3,
    color = 'white',
    position = 'center',
  } = options;

  const image = sharp(inputBuffer);
  const metadata = await image.metadata();

  const width = metadata.width || 800;
  const height = metadata.height || 600;

  // Calculate watermark text positioning
  let x: number;
  let y: number;

  switch (position) {
    case 'bottom-right':
      x = Math.max(width - fontSize * text.length * 0.5 - 20, 20);
      y = height - fontSize - 20;
      break;
    case 'bottom-left':
      x = 20;
      y = height - fontSize - 20;
      break;
    case 'center':
    default:
      x = Math.max((width - fontSize * text.length * 0.5) / 2, 0);
      y = (height - fontSize) / 2;
      break;
  }

  const opacityHex = Math.round(opacity * 255).toString(16).padStart(2, '0');
  const fillColor = color === 'white' ? `#ffffff${opacityHex}` : `#000000${opacityHex}`;

  const svgOverlay = Buffer.from(
    `<svg width="${width}" height="${height}">
      <text
        x="${x}"
        y="${y}"
        font-size="${fontSize}"
        fill="${fillColor}"
        font-family="sans-serif"
        font-weight="bold"
      >${escapeXml(text)}</text>
    </svg>`
  );

  const result = await image
    .composite([
      {
        input: svgOverlay,
        top: 0,
        left: 0,
      },
    ])
    .toBuffer();

  return result;
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
