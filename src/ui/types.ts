import type { Vec2 } from '../core/types';
import type { ImageSource } from '../platform/fileIO';

export type Tool = 'crop' | 'rotate' | 'adjust' | 'hand';

export type AspectPreset = 'free' | '1:1' | '3:2' | '4:3' | '16:9' | 'custom';

export type ViewState = {
  zoom: number;
  pan: Vec2;
};

export type LoadedImage = ImageSource;
