import type { Vec2 } from '../core/types';
import type { ImageSource } from '../platform/fileIO';

export type Tool = 'crop' | 'rotate' | 'adjust';

export type ViewState = {
  zoom: number;
  pan: Vec2;
};

export type LoadedImage = ImageSource;
