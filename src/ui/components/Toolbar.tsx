import {
  Crop,
  Download,
  FolderOpen,
  Hand,
  Redo2,
  RefreshCcw,
  RotateCcw,
  RotateCw,
  Sliders,
  Undo2,
} from 'lucide-react';
import type { Tool } from '../types';

const ToolButton = ({
  active,
  label,
  onClick,
  badge,
  children,
}: {
  active?: boolean;
  label: string;
  onClick: () => void;
  badge?: boolean;
  children: React.ReactNode;
}) => (
  <button
    className={`tool-btn ${active ? 'active' : ''}`}
    onClick={onClick}
    aria-label={label}
    title={label}
  >
    {children}
    {badge ? <span className="tool-badge" /> : null}
  </button>
);

export type ToolbarProps = {
  tool: Tool;
  onToolChange: (tool: Tool) => void;
  onOpen: () => void;
  onExport: () => void;
  onRotateLeft: () => void;
  onRotateRight: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onResetAdjustments: () => void;
  adjustmentsActive: boolean;
  canExport: boolean;
};

export const Toolbar = ({
  tool,
  onToolChange,
  onOpen,
  onExport,
  onRotateLeft,
  onRotateRight,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  onResetAdjustments,
  adjustmentsActive,
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
          active={tool === 'hand'}
          label="Hand"
          onClick={() => onToolChange('hand')}
        >
          <Hand size={18} />
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
          badge={adjustmentsActive}
        >
          <Sliders size={18} />
        </ToolButton>
      </div>

      <div className="toolbar-divider" />

      <div className="toolbar-actions">
        <button
          className="tool-btn"
          onClick={onUndo}
          title="Undo"
          disabled={!canUndo}
        >
          <Undo2 size={18} />
        </button>
        <button
          className="tool-btn"
          onClick={onRedo}
          title="Redo"
          disabled={!canRedo}
        >
          <Redo2 size={18} />
        </button>
        <button
          className="tool-btn"
          onClick={onResetAdjustments}
          title="Reset Adjustments"
          disabled={!adjustmentsActive}
        >
          <RefreshCcw size={18} />
        </button>
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
