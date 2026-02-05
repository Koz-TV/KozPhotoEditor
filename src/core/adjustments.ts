import type { Adjustments } from './types';
import { clamp } from './geometry';

const EPSILON = 0.0001;

export const DEFAULT_ADJUSTMENTS: Adjustments = {
  brightness: 0,
  contrast: 0,
  curve: 0,
};

export const normalizeAdjustments = (adjustments?: Partial<Adjustments> | null): Adjustments => ({
  ...DEFAULT_ADJUSTMENTS,
  ...adjustments,
});

export const isDefaultAdjustments = (adjustments?: Partial<Adjustments> | null) => {
  const normalized = normalizeAdjustments(adjustments);
  return (
    Math.abs(normalized.brightness) < EPSILON &&
    Math.abs(normalized.contrast) < EPSILON &&
    Math.abs(normalized.curve) < EPSILON
  );
};

const buildCurveLut = (amount: number) => {
  const lut = new Uint8ClampedArray(256);
  const a = clamp(amount, -1, 1) * 8;
  if (Math.abs(a) < EPSILON) {
    for (let i = 0; i < 256; i += 1) lut[i] = i;
    return lut;
  }
  const min = 1 / (1 + Math.exp(a / 2));
  const max = 1 / (1 + Math.exp(-a / 2));
  for (let i = 0; i < 256; i += 1) {
    const x = i / 255;
    const y = 1 / (1 + Math.exp(-a * (x - 0.5)));
    const normalized = (y - min) / (max - min);
    lut[i] = Math.round(clamp(normalized, 0, 1) * 255);
  }
  return lut;
};

export const applyAdjustmentsToBitmap = async (
  image: ImageBitmap,
  adjustments: Adjustments
): Promise<ImageBitmap> => {
  const canvas = document.createElement('canvas');
  canvas.width = image.width;
  canvas.height = image.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Unable to create canvas context');

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(image, 0, 0);
  const brightness = clamp(adjustments.brightness, -1, 1);
  const contrast = clamp(adjustments.contrast, -1, 1);
  const curve = clamp(adjustments.curve, -1, 1);

  const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const pixels = data.data;
  const brightnessShift = brightness * 255;
  const contrastFactor = 1 + contrast;
  const lut = Math.abs(curve) > EPSILON ? buildCurveLut(curve) : null;

  for (let i = 0; i < pixels.length; i += 4) {
    let r = (pixels[i] - 128) * contrastFactor + 128 + brightnessShift;
    let g = (pixels[i + 1] - 128) * contrastFactor + 128 + brightnessShift;
    let b = (pixels[i + 2] - 128) * contrastFactor + 128 + brightnessShift;

    r = clamp(r, 0, 255);
    g = clamp(g, 0, 255);
    b = clamp(b, 0, 255);

    if (lut) {
      pixels[i] = lut[Math.round(r)];
      pixels[i + 1] = lut[Math.round(g)];
      pixels[i + 2] = lut[Math.round(b)];
    } else {
      pixels[i] = Math.round(r);
      pixels[i + 1] = Math.round(g);
      pixels[i + 2] = Math.round(b);
    }
  }

  ctx.putImageData(data, 0, 0);

  return createImageBitmap(canvas);
};
