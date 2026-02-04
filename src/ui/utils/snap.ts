import type { Handle, Rect } from '../../core/types';

export type Guide = { axis: 'x' | 'y'; value: number; kind: 'edge' | 'center' | 'third' };

type SnapResult = { rect: Rect; guides: Guide[] };

const makeTargets = (size: number, offset: number) => [
  { value: offset, kind: 'edge' as const },
  { value: offset + size / 3, kind: 'third' as const },
  { value: offset + (2 * size) / 3, kind: 'third' as const },
  { value: offset + size / 2, kind: 'center' as const },
  { value: offset + size, kind: 'edge' as const },
];

const chooseSnap = (
  positions: { key: string; value: number }[],
  targets: { value: number; kind: Guide['kind'] }[],
  threshold: number
) => {
  let best: { key: string; delta: number; kind: Guide['kind'] } | null = null;

  for (const pos of positions) {
    for (const target of targets) {
      const delta = target.value - pos.value;
      if (Math.abs(delta) <= threshold) {
        if (!best || Math.abs(delta) < Math.abs(best.delta)) {
          best = { key: pos.key, delta, kind: target.kind };
        }
      }
    }
  }

  return best;
};

export const snapRect = (
  rect: Rect,
  bounds: Rect,
  threshold: number,
  mode: 'move' | 'resize',
  handle?: Handle
): SnapResult => {
  const guides: Guide[] = [];
  let { x, y, w, h } = rect;

  const left = x;
  const right = x + w;
  const top = y;
  const bottom = y + h;
  const centerX = x + w / 2;
  const centerY = y + h / 2;

  const xTargets = makeTargets(bounds.w, bounds.x);
  const yTargets = makeTargets(bounds.h, bounds.y);

  const activeX: { key: string; value: number }[] = [];
  const activeY: { key: string; value: number }[] = [];

  if (mode === 'move') {
    activeX.push(
      { key: 'left', value: left },
      { key: 'centerX', value: centerX },
      { key: 'right', value: right }
    );
    activeY.push(
      { key: 'top', value: top },
      { key: 'centerY', value: centerY },
      { key: 'bottom', value: bottom }
    );
  } else if (handle) {
    if (handle.includes('w')) activeX.push({ key: 'left', value: left });
    if (handle.includes('e')) activeX.push({ key: 'right', value: right });
    if (handle.includes('n')) activeY.push({ key: 'top', value: top });
    if (handle.includes('s')) activeY.push({ key: 'bottom', value: bottom });
  }

  const xSnap = chooseSnap(activeX, xTargets, threshold);
  if (xSnap) {
    guides.push({ axis: 'x', value: xSnap.delta + (xSnap.key === 'left' ? left : xSnap.key === 'right' ? right : centerX), kind: xSnap.kind });
    if (mode === 'move') {
      x += xSnap.delta;
    } else if (xSnap.key === 'left') {
      x += xSnap.delta;
      w = right - x;
    } else if (xSnap.key === 'right') {
      w = right + xSnap.delta - x;
    }
  }

  const ySnap = chooseSnap(activeY, yTargets, threshold);
  if (ySnap) {
    guides.push({ axis: 'y', value: ySnap.delta + (ySnap.key === 'top' ? top : ySnap.key === 'bottom' ? bottom : centerY), kind: ySnap.kind });
    if (mode === 'move') {
      y += ySnap.delta;
    } else if (ySnap.key === 'top') {
      y += ySnap.delta;
      h = bottom - y;
    } else if (ySnap.key === 'bottom') {
      h = bottom + ySnap.delta - y;
    }
  }

  return { rect: { x, y, w, h }, guides };
};
