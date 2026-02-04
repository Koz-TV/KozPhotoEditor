import type { CropModifiers, Handle, Rect, Rotation, Vec2 } from './types';
import { clampRectEdges, clampRectInside, rectCenter } from './geometry';

const MIN_SIZE = 1;

const handleHas = (handle: Handle, dir: 'n' | 's' | 'e' | 'w') =>
  handle.includes(dir);

const getActiveEdges = (handle: Handle, symmetric: boolean) => {
  const affectsX = handleHas(handle, 'e') || handleHas(handle, 'w');
  const affectsY = handleHas(handle, 'n') || handleHas(handle, 's');

  return {
    left: affectsX && (handleHas(handle, 'w') || symmetric),
    right: affectsX && (handleHas(handle, 'e') || symmetric),
    top: affectsY && (handleHas(handle, 'n') || symmetric),
    bottom: affectsY && (handleHas(handle, 's') || symmetric),
    affectsX,
    affectsY,
  };
};

const ensureMinSize = (
  left: number,
  right: number,
  top: number,
  bottom: number,
  active: ReturnType<typeof getActiveEdges>
) => {
  let newLeft = left;
  let newRight = right;
  let newTop = top;
  let newBottom = bottom;

  const width = newRight - newLeft;
  if (width < MIN_SIZE) {
    if (active.left && !active.right) {
      newLeft = newRight - MIN_SIZE;
    } else if (active.right && !active.left) {
      newRight = newLeft + MIN_SIZE;
    } else {
      const cx = (newLeft + newRight) / 2;
      newLeft = cx - MIN_SIZE / 2;
      newRight = cx + MIN_SIZE / 2;
    }
  }

  const height = newBottom - newTop;
  if (height < MIN_SIZE) {
    if (active.top && !active.bottom) {
      newTop = newBottom - MIN_SIZE;
    } else if (active.bottom && !active.top) {
      newBottom = newTop + MIN_SIZE;
    } else {
      const cy = (newTop + newBottom) / 2;
      newTop = cy - MIN_SIZE / 2;
      newBottom = cy + MIN_SIZE / 2;
    }
  }

  return { left: newLeft, right: newRight, top: newTop, bottom: newBottom };
};

const applyAspectRatio = (
  left: number,
  right: number,
  top: number,
  bottom: number,
  handle: Handle,
  aspect: number,
  symmetric: boolean
) => {
  const hasE = handleHas(handle, 'e');
  const hasW = handleHas(handle, 'w');
  const hasN = handleHas(handle, 'n');
  const hasS = handleHas(handle, 's');
  const isCorner = (hasE || hasW) && (hasN || hasS);

  const width = Math.abs(right - left);
  const height = Math.abs(bottom - top);
  let newW = width;
  let newH = height;

  if (isCorner) {
    if (width / height > aspect) {
      newH = height;
      newW = height * aspect;
    } else {
      newW = width;
      newH = width / aspect;
    }
  } else if (hasE || hasW) {
    newW = width;
    newH = width / aspect;
  } else if (hasN || hasS) {
    newH = height;
    newW = height * aspect;
  }

  if (symmetric) {
    const cx = (left + right) / 2;
    const cy = (top + bottom) / 2;
    return {
      left: cx - newW / 2,
      right: cx + newW / 2,
      top: cy - newH / 2,
      bottom: cy + newH / 2,
    };
  }

  let nextLeft = left;
  let nextRight = right;
  let nextTop = top;
  let nextBottom = bottom;

  if (hasE && !hasW) {
    nextRight = nextLeft + newW;
  } else if (hasW && !hasE) {
    nextLeft = nextRight - newW;
  }

  if (hasS && !hasN) {
    nextBottom = nextTop + newH;
  } else if (hasN && !hasS) {
    nextTop = nextBottom - newH;
  }

  if (!isCorner) {
    if (hasE || hasW) {
      const cy = (nextTop + nextBottom) / 2;
      nextTop = cy - newH / 2;
      nextBottom = cy + newH / 2;
    }

    if (hasN || hasS) {
      const cx = (nextLeft + nextRight) / 2;
      nextLeft = cx - newW / 2;
      nextRight = cx + newW / 2;
    }
  }

  return { left: nextLeft, right: nextRight, top: nextTop, bottom: nextBottom };
};

export const moveCropRect = (
  rect: Rect,
  delta: Vec2,
  bounds: Rect | null,
  allowOutside: boolean
): Rect => {
  const moved = {
    x: rect.x + delta.x,
    y: rect.y + delta.y,
    w: rect.w,
    h: rect.h,
  };

  if (!allowOutside && bounds) {
    return clampRectInside(moved, bounds);
  }

  return moved;
};

export const resizeCropRect = (
  rect: Rect,
  handle: Handle,
  delta: Vec2,
  modifiers: CropModifiers,
  bounds: Rect | null,
  allowOutside: boolean
): Rect => {
  let left = rect.x;
  let right = rect.x + rect.w;
  let top = rect.y;
  let bottom = rect.y + rect.h;

  const symmetric = modifiers.symmetric;
  const aspect = modifiers.square ? 1 : modifiers.aspectRatio ?? null;

  if (symmetric) {
    if (handleHas(handle, 'e')) {
      right += delta.x;
      left -= delta.x;
    }
    if (handleHas(handle, 'w')) {
      left += delta.x;
      right -= delta.x;
    }
    if (handleHas(handle, 's')) {
      bottom += delta.y;
      top -= delta.y;
    }
    if (handleHas(handle, 'n')) {
      top += delta.y;
      bottom -= delta.y;
    }
  } else {
    if (handleHas(handle, 'e')) right += delta.x;
    if (handleHas(handle, 'w')) left += delta.x;
    if (handleHas(handle, 's')) bottom += delta.y;
    if (handleHas(handle, 'n')) top += delta.y;
  }

  const active = getActiveEdges(handle, symmetric);
  ({ left, right, top, bottom } = ensureMinSize(left, right, top, bottom, active));

  if (aspect && aspect > 0) {
    ({ left, right, top, bottom } = applyAspectRatio(
      left,
      right,
      top,
      bottom,
      handle,
      aspect,
      symmetric
    ));
  }

  ({ left, right, top, bottom } = ensureMinSize(left, right, top, bottom, active));

  let nextRect = {
    x: left,
    y: top,
    w: right - left,
    h: bottom - top,
  };

  if (!allowOutside && bounds) {
    nextRect = clampRectEdges(nextRect, bounds);
  }

  return nextRect;
};

export const getOrientedSize = (width: number, height: number, rotation: Rotation) => {
  if (rotation === 90 || rotation === 270) {
    return { w: height, h: width };
  }
  return { w: width, h: height };
};

export const rotateRect = (
  rect: Rect,
  rotation: Rotation | -90,
  width: number,
  height: number
): Rect => {
  const rot = ((rotation % 360) + 360) % 360;

  switch (rot) {
    case 0:
      return { ...rect };
    case 90:
      return {
        x: height - (rect.y + rect.h),
        y: rect.x,
        w: rect.h,
        h: rect.w,
      };
    case 180:
      return {
        x: width - (rect.x + rect.w),
        y: height - (rect.y + rect.h),
        w: rect.w,
        h: rect.h,
      };
    case 270:
      return {
        x: rect.y,
        y: width - (rect.x + rect.w),
        w: rect.h,
        h: rect.w,
      };
    default:
      return { ...rect };
  }
};

export const rectToBounds = (bounds: Rect): Rect => ({
  x: bounds.x,
  y: bounds.y,
  w: bounds.w,
  h: bounds.h,
});

export const centerRectAt = (rect: Rect, center: Vec2): Rect => ({
  x: center.x - rect.w / 2,
  y: center.y - rect.h / 2,
  w: rect.w,
  h: rect.h,
});

export const ensureRectInBounds = (rect: Rect, bounds: Rect): Rect =>
  clampRectInside(rect, bounds);

export const rectFromCenterAndSize = (center: Vec2, w: number, h: number): Rect => ({
  x: center.x - w / 2,
  y: center.y - h / 2,
  w,
  h,
});

export const rectForAspectFromCenter = (
  center: Vec2,
  size: number,
  aspect: number
): Rect => ({
  x: center.x - (size * aspect) / 2,
  y: center.y - size / 2,
  w: size * aspect,
  h: size,
});

export const rectToCenter = (rect: Rect) => rectCenter(rect);
