export type Vec2 = { x: number; y: number };

export type Rect = { x: number; y: number; w: number; h: number };

export type Handle = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

export type Rotation = 0 | 90 | 180 | 270;

export type CropModifiers = {
  square: boolean;
  symmetric: boolean;
  aspectRatio?: number | null;
};

export type Adjustments = {
  brightness: number;
  contrast: number;
  curve: number;
};

export type TransformState = {
  cropRect: Rect | null;
  rotation: Rotation;
  straighten: number;
  flipH: boolean;
  flipV: boolean;
  adjustments: Adjustments;
};

export type HistoryState<T> = {
  past: T[];
  present: T;
  future: T[];
};
