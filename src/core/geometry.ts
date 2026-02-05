import type { Rect, Vec2 } from './types';

export const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export const rectFromPoints = (a: Vec2, b: Vec2): Rect => {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  const w = Math.abs(b.x - a.x);
  const h = Math.abs(b.y - a.y);
  return { x, y, w, h };
};

export const rectFromPointsWithAspect = (
  a: Vec2,
  b: Vec2,
  aspect: number | null
): Rect => {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  let w = Math.abs(dx);
  let h = Math.abs(dy);

  if (aspect && aspect > 0) {
    if (w / h > aspect) {
      w = h * aspect;
    } else {
      h = w / aspect;
    }
  }

  const x = dx >= 0 ? a.x : a.x - w;
  const y = dy >= 0 ? a.y : a.y - h;

  return { x, y, w, h };
};

export const rectCenter = (rect: Rect): Vec2 => ({
  x: rect.x + rect.w / 2,
  y: rect.y + rect.h / 2,
});

export const clampRectInside = (rect: Rect, bounds: Rect): Rect => {
  let x = rect.x;
  let y = rect.y;
  let w = rect.w;
  let h = rect.h;

  if (w > bounds.w) w = bounds.w;
  if (h > bounds.h) h = bounds.h;

  x = clamp(x, bounds.x, bounds.x + bounds.w - w);
  y = clamp(y, bounds.y, bounds.y + bounds.h - h);

  return { x, y, w, h };
};

export const clampRectEdges = (rect: Rect, bounds: Rect): Rect => {
  let left = rect.x;
  let top = rect.y;
  let right = rect.x + rect.w;
  let bottom = rect.y + rect.h;

  left = Math.max(left, bounds.x);
  top = Math.max(top, bounds.y);
  right = Math.min(right, bounds.x + bounds.w);
  bottom = Math.min(bottom, bounds.y + bounds.h);

  const w = Math.max(1, right - left);
  const h = Math.max(1, bottom - top);

  return { x: left, y: top, w, h };
};

export const rotatedBounds = (width: number, height: number, angleDeg: number) => {
  const radians = (angleDeg * Math.PI) / 180;
  const sin = Math.abs(Math.sin(radians));
  const cos = Math.abs(Math.cos(radians));
  return {
    w: width * cos + height * sin,
    h: width * sin + height * cos,
  };
};
