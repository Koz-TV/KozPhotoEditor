import type { Rotation, TransformState } from './types';
import { getOrientedSize } from './crop';
import { rotatedBounds } from './geometry';
import { applyAdjustmentsToBitmap, isDefaultAdjustments, normalizeAdjustments } from './adjustments';

export type ExportFormat = 'image/png' | 'image/jpeg' | 'image/webp';

export const getRotationRadians = (rotation: Rotation) =>
  (rotation * Math.PI) / 180;

const drawTransformed = (
  ctx: CanvasRenderingContext2D,
  image: ImageBitmap,
  transform: TransformState
) => {
  const rotationRad = (transform.rotation * Math.PI) / 180;
  const straightenRad = (transform.straighten * Math.PI) / 180;

  ctx.save();
  ctx.translate(ctx.canvas.width / 2, ctx.canvas.height / 2);
  ctx.rotate(straightenRad);
  ctx.scale(transform.flipH ? -1 : 1, transform.flipV ? -1 : 1);
  ctx.rotate(rotationRad);
  ctx.drawImage(image, -image.width / 2, -image.height / 2);
  ctx.restore();
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
  const displayBounds = rotatedBounds(oriented.w, oriented.h, transform.straighten);

  const normalizedAdjustments = normalizeAdjustments(transform.adjustments);
  let adjustedBitmap: ImageBitmap | null = null;
  let sourceBitmap = image;
  if (!isDefaultAdjustments(normalizedAdjustments)) {
    adjustedBitmap = await applyAdjustmentsToBitmap(image, normalizedAdjustments);
    sourceBitmap = adjustedBitmap;
  }

  const fullCanvas = document.createElement('canvas');
  fullCanvas.width = Math.max(1, Math.round(displayBounds.w));
  fullCanvas.height = Math.max(1, Math.round(displayBounds.h));
  const fullCtx = fullCanvas.getContext('2d');
  if (!fullCtx) throw new Error('Unable to create canvas context');

  fullCtx.imageSmoothingEnabled = true;
  fullCtx.imageSmoothingQuality = 'high';
  drawTransformed(fullCtx, sourceBitmap, transform);

  const cropRect =
    transform.cropRect ?? { x: 0, y: 0, w: fullCanvas.width, h: fullCanvas.height };

  let outputCanvas = fullCanvas;
  if (transform.cropRect) {
    const cropCanvas = document.createElement('canvas');
    cropCanvas.width = Math.max(1, Math.round(cropRect.w));
    cropCanvas.height = Math.max(1, Math.round(cropRect.h));
    const cropCtx = cropCanvas.getContext('2d');
    if (!cropCtx) throw new Error('Unable to create canvas context');

    cropCtx.imageSmoothingEnabled = true;
    cropCtx.imageSmoothingQuality = 'high';
    cropCtx.drawImage(fullCanvas, -cropRect.x, -cropRect.y);
    outputCanvas = cropCanvas;
  }

  try {
    return await new Promise<Blob>((resolve, reject) => {
      outputCanvas.toBlob(
        (result) => (result ? resolve(result) : reject(new Error('Export failed'))),
        format,
        quality
      );
    });
  } finally {
    adjustedBitmap?.close?.();
  }
};
