import { Maximize2, Minus, Moon, Plus, Sun } from 'lucide-react';
import type { LoadedImage } from '../types';

export type StatusBarProps = {
  image: LoadedImage | null;
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomFit: () => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
};

export const StatusBar = ({
  image,
  zoom,
  onZoomIn,
  onZoomOut,
  onZoomFit,
  theme,
  onToggleTheme,
}: StatusBarProps) => {
  return (
    <div className="status-bar">
      <div className="status-left">
        <span className="status-item">Zoom {Math.round(zoom * 100)}%</span>
        {image && (
          <span className="status-item">
            {image.width}×{image.height}px
          </span>
        )}
        <span className="status-hint">
          Shift: Square · Option/Alt: Symmetric · Space: Pan · Enter: Apply · Esc: Reset
        </span>
      </div>
      <div className="status-right">
        <button className="icon-btn" onClick={onZoomOut} title="Zoom Out">
          <Minus size={14} />
        </button>
        <button className="icon-btn" onClick={onZoomIn} title="Zoom In">
          <Plus size={14} />
        </button>
        <button className="icon-btn" onClick={onZoomFit} title="Fit to Screen">
          <Maximize2 size={14} />
        </button>
        <div className="status-divider" />
        <button className="icon-btn" onClick={onToggleTheme} title="Toggle Theme">
          {theme === 'light' ? <Moon size={14} /> : <Sun size={14} />}
        </button>
      </div>
    </div>
  );
};
