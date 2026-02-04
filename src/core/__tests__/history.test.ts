import { describe, expect, it } from 'vitest';
import type { TransformState } from '../types';
import { createHistory, pushHistory, redoHistory, undoHistory } from '../history';

const base: TransformState = { cropRect: null, rotation: 0 };

describe('history', () => {
  it('push/undo/redo for crop', () => {
    const history = createHistory(base);
    const withCrop = pushHistory(history, {
      ...base,
      cropRect: { x: 10, y: 10, w: 50, h: 40 },
    });

    expect(withCrop.present.cropRect?.w).toBe(50);

    const undone = undoHistory(withCrop);
    expect(undone.present.cropRect).toBeNull();

    const redone = redoHistory(undone);
    expect(redone.present.cropRect?.h).toBe(40);
  });

  it('push/undo/redo for rotate', () => {
    const history = createHistory(base);
    const rotated = pushHistory(history, { ...base, rotation: 90 });
    expect(rotated.present.rotation).toBe(90);

    const undone = undoHistory(rotated);
    expect(undone.present.rotation).toBe(0);

    const redone = redoHistory(undone);
    expect(redone.present.rotation).toBe(90);
  });
});
