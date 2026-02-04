import {
  Crop,
  Download,
  FolderOpen,
  RotateCcw,
  RotateCw,
  Sliders,
} from 'lucide-react';
import type { Tool } from '../types';

const ToolButton = ({
  active,
  label,
  onClick,
  children,
}: {
  active?: boolean;
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) => (
  <button
    className={`tool-btn ${active ? 'active' : ''}`}
    onClick={onClick}
    aria-label={label}
    title={label}
  >
    {children}
  </button>
);

export type ToolbarProps = {
  tool: Tool;
  onToolChange: (tool: Tool) => void;
  onOpen: () => void;
  onExport: () => void;
  onRotateLeft: () => void;
  onRotateRight: () => void;
  canExport: boolean;
};

export const Toolbar = ({
  tool,
  onToolChange,
  onOpen,
  onExport,
  onRotateLeft,
  onRotateRight,
  canExport,
}: ToolbarProps) => {
  return (
    <div className="toolbar">
      <div className="toolbar-top">
        <div className="toolbar-logo">KOZ</div>
        <button className="tool-btn" onClick={onOpen} aria-label="Open" title="Open">
          <FolderOpen size={18} />
        </button>
        <button
          className="tool-btn"
          onClick={onExport}
          aria-label="Export"
          title="Export"
          disabled={!canExport}
        >
          <Download size={18} />
        </button>
      </div>

      <div className="toolbar-divider" />

      <div className="toolbar-tools">
        <ToolButton
          active={tool === 'crop'}
          label="Crop"
          onClick={() => onToolChange('crop')}
        >
          <Crop size={18} />
        </ToolButton>
        <ToolButton
          active={tool === 'rotate'}
          label="Rotate"
          onClick={() => onToolChange('rotate')}
        >
          <RotateCw size={18} />
        </ToolButton>
        <ToolButton
          active={tool === 'adjust'}
          label="Adjust"
          onClick={() => onToolChange('adjust')}
        >
          <Sliders size={18} />
        </ToolButton>
      </div>

      <div className="toolbar-divider" />

      <div className="toolbar-actions">
        <button className="tool-btn" onClick={onRotateLeft} title="Rotate Left">
          <RotateCcw size={18} />
        </button>
        <button className="tool-btn" onClick={onRotateRight} title="Rotate Right">
          <RotateCw size={18} />
        </button>
      </div>
    </div>
  );
};
