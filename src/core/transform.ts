import type { Rect, Rotation, TransformState } from './types';
import { getOrientedSize, rotateRect } from './crop';

export type ExportFormat = 'image/png' | 'image/jpeg' | 'image/webp';

export const getRotationRadians = (rotation: Rotation) =>
  (rotation * Math.PI) / 180;

export const unrotateRectToOriginal = (
  rect: Rect,
  rotation: Rotation,
  baseWidth: number,
  baseHeight: number
): Rect => {
  if (rotation === 0) return rect;
  const oriented = getOrientedSize(baseWidth, baseHeight, rotation);
  return rotateRect(rect, (360 - rotation) as Rotation, oriented.w, oriented.h);
};

const drawRotated = (
  ctx: CanvasRenderingContext2D,
  source: CanvasImageSource,
  rotation: Rotation,
  width: number,
  height: number
) => {
  switch (rotation) {
    case 0:
      ctx.drawImage(source, 0, 0);
      break;
    case 90:
      ctx.translate(width, 0);
      ctx.rotate(Math.PI / 2);
      ctx.drawImage(source, 0, 0);
      break;
    case 180:
      ctx.translate(width, height);
      ctx.rotate(Math.PI);
      ctx.drawImage(source, 0, 0);
      break;
    case 270:
      ctx.translate(0, height);
      ctx.rotate(-Math.PI / 2);
      ctx.drawImage(source, 0, 0);
      break;
    default:
      ctx.drawImage(source, 0, 0);
  }
};

export const exportTransformedImage = async (options: {
  image: ImageBitmap;
  transform: TransformState;
  format: ExportFormat;
  quality?: number;
}): Promise<Blob> => {
  const { image, transform, format, quality } = options;
  const baseWidth = image.width;
  const baseHeight = image.height;

  const oriented = getOrientedSize(baseWidth, baseHeight, transform.rotation);
  const cropRect = transform.cropRect ?? { x: 0, y: 0, w: oriented.w, h: oriented.h };
  const cropOriginal = unrotateRectToOriginal(
    cropRect,
    transform.rotation,
    baseWidth,
    baseHeight
  );

  const cropCanvas = document.createElement('canvas');
  cropCanvas.width = Math.max(1, Math.round(cropOriginal.w));
  cropCanvas.height = Math.max(1, Math.round(cropOriginal.h));
  const cropCtx = cropCanvas.getContext('2d');
  if (!cropCtx) throw new Error('Unable to create canvas context');

  cropCtx.imageSmoothingEnabled = true;
  cropCtx.imageSmoothingQuality = 'high';
  cropCtx.drawImage(
    image,
    Math.round(-cropOriginal.x),
    Math.round(-cropOriginal.y)
  );

  if (transform.rotation === 0) {
    return new Promise((resolve, reject) => {
      cropCanvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('Export failed'))),
        format,
        quality
      );
    });
  }

  const rotatedCanvas = document.createElement('canvas');
  rotatedCanvas.width = Math.round(cropRect.w);
  rotatedCanvas.height = Math.round(cropRect.h);
  const rotCtx = rotatedCanvas.getContext('2d');
  if (!rotCtx) throw new Error('Unable to create canvas context');

  rotCtx.imageSmoothingEnabled = true;
  rotCtx.imageSmoothingQuality = 'high';
  rotCtx.save();
  drawRotated(rotCtx, cropCanvas, transform.rotation, rotatedCanvas.width, rotatedCanvas.height);
  rotCtx.restore();

  return new Promise((resolve, reject) => {
    rotatedCanvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Export failed'))),
      format,
      quality
    );
  });
};
