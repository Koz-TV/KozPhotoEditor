import { describe, expect, it } from 'vitest';
import { resizeCropRect, rotateRect } from '../crop';
import type { Rect } from '../types';

const baseRect: Rect = { x: 10, y: 10, w: 100, h: 50 };

describe('resizeCropRect', () => {
  it('keeps square when square modifier is on', () => {
    const rect = resizeCropRect(
      baseRect,
      'se',
      { x: 30, y: 5 },
      { square: true, symmetric: false },
      null,
      true
    );

    expect(Math.round(rect.w)).toBe(Math.round(rect.h));
  });

  it('resizes symmetrically from center with option', () => {
    const rect = resizeCropRect(
      baseRect,
      'e',
      { x: 10, y: 0 },
      { square: false, symmetric: true },
      null,
      true
    );

    expect(Math.round(rect.w)).toBe(120);
    expect(Math.round(rect.x + rect.w / 2)).toBe(60);
  });

  it('clamps to bounds when outside is disallowed', () => {
    const rect = resizeCropRect(
      baseRect,
      'se',
      { x: 500, y: 500 },
      { square: false, symmetric: false },
      { x: 0, y: 0, w: 200, h: 120 },
      false
    );

    expect(rect.x + rect.w).toBeLessThanOrEqual(200);
    expect(rect.y + rect.h).toBeLessThanOrEqual(120);
  });
});

describe('rotateRect', () => {
  it('rotates rect clockwise 90 degrees', () => {
    const rect = rotateRect({ x: 10, y: 20, w: 30, h: 40 }, 90, 100, 200);
    expect(rect.w).toBe(40);
    expect(rect.h).toBe(30);
  });
});
