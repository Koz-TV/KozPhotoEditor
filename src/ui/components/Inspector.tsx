import type { Rect } from '../../core/types';
import type { LoadedImage, Tool } from '../types';

const AspectOptions = [
  { label: 'Free', value: 'free' },
  { label: '1:1', value: '1' },
  { label: '4:3', value: '1.3333' },
  { label: '16:9', value: '1.7778' },
];

const formatBytes = (bytes: number) => {
  if (!bytes) return '—';
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let i = 0;
  while (value > 1024 && i < units.length - 1) {
    value /= 1024;
    i += 1;
  }
  return `${value.toFixed(value < 10 && i > 0 ? 1 : 0)} ${units[i]}`;
};

const NumberField = ({
  label,
  value,
  onChange,
  disabled,
  testId,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  testId?: string;
}) => (
  <label className="field">
    <span>{label}</span>
    <input
      type="number"
      data-testid={testId}
      value={Number.isFinite(value) ? Math.round(value) : ''}
      onChange={(event) => onChange(Number(event.target.value))}
      disabled={disabled}
    />
  </label>
);

export type InspectorProps = {
  tool: Tool;
  image: LoadedImage | null;
  cropRect: Rect | null;
  setCropRect: (rect: Rect | null) => void;
  aspectRatio: number | null;
  setAspectRatio: (value: number | null) => void;
  allowOutside: boolean;
  setAllowOutside: (value: boolean) => void;
  onApplyCrop: () => void;
  onResetCrop: () => void;
  onRotateLeft: () => void;
  onRotateRight: () => void;
  exportFormat: 'image/png' | 'image/jpeg' | 'image/webp';
  setExportFormat: (value: 'image/png' | 'image/jpeg' | 'image/webp') => void;
  jpegQuality: number;
  setJpegQuality: (value: number) => void;
  debugLog: string[];
  showDebug?: boolean;
};

export const Inspector = ({
  tool,
  image,
  cropRect,
  setCropRect,
  aspectRatio,
  setAspectRatio,
  allowOutside,
  setAllowOutside,
  onApplyCrop,
  onResetCrop,
  onRotateLeft,
  onRotateRight,
  exportFormat,
  setExportFormat,
  jpegQuality,
  setJpegQuality,
  debugLog,
  showDebug = false,
}: InspectorProps) => {
  const bounds = image ? { x: 0, y: 0, w: image.width, h: image.height } : null;

  return (
    <div className="inspector">
      <div className="panel">
        <div className="panel-title">Image</div>
        {image ? (
          <div className="panel-body">
            <div className="meta-row">
              <span>Size</span>
              <span>
                {image.width}×{image.height}px
              </span>
            </div>
            <div className="meta-row">
              <span>Format</span>
              <span>{image.type || '—'}</span>
            </div>
            <div className="meta-row">
              <span>File size</span>
              <span>{formatBytes(image.size)}</span>
            </div>
          </div>
        ) : (
          <div className="panel-body muted">No image loaded.</div>
        )}
      </div>

      {tool === 'crop' && (
        <div className="panel">
          <div className="panel-title">Crop</div>
          <div className="panel-body">
            <label className="field">
              <span>Aspect ratio</span>
              <select
                value={aspectRatio ? aspectRatio.toString() : 'free'}
                onChange={(event) => {
                  const value = event.target.value;
                  setAspectRatio(value === 'free' ? null : Number(value));
                }}
                disabled={!image}
              >
                {AspectOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <div className="field-grid">
              <NumberField
                label="X"
                value={cropRect?.x ?? 0}
                disabled={!cropRect}
                testId="crop-x"
                onChange={(value) =>
                  cropRect && setCropRect({ ...cropRect, x: value })
                }
              />
              <NumberField
                label="Y"
                value={cropRect?.y ?? 0}
                disabled={!cropRect}
                testId="crop-y"
                onChange={(value) =>
                  cropRect && setCropRect({ ...cropRect, y: value })
                }
              />
              <NumberField
                label="W"
                value={cropRect?.w ?? 0}
                disabled={!cropRect}
                testId="crop-w"
                onChange={(value) =>
                  cropRect && setCropRect({ ...cropRect, w: Math.max(1, value) })
                }
              />
              <NumberField
                label="H"
                value={cropRect?.h ?? 0}
                disabled={!cropRect}
                testId="crop-h"
                onChange={(value) =>
                  cropRect && setCropRect({ ...cropRect, h: Math.max(1, value) })
                }
              />
            </div>

            <label className="toggle">
              <input
                type="checkbox"
                checked={allowOutside}
                onChange={(event) => setAllowOutside(event.target.checked)}
              />
              <span>Allow outside bounds</span>
            </label>

            <div className="panel-actions">
              <button className="btn" onClick={onResetCrop} disabled={!image} data-testid="crop-reset">
                Reset
              </button>
              <button
                className="btn primary"
                onClick={onApplyCrop}
                disabled={!cropRect}
                data-testid="crop-apply"
              >
                Apply crop
              </button>
            </div>
          </div>
        </div>
      )}

      {tool === 'rotate' && (
        <div className="panel">
          <div className="panel-title">Rotate</div>
          <div className="panel-body">
            <div className="panel-actions">
              <button className="btn" onClick={onRotateLeft} disabled={!image}>
                Rotate 90° Left
              </button>
              <button className="btn" onClick={onRotateRight} disabled={!image}>
                Rotate 90° Right
              </button>
            </div>
            <label className="field">
              <span>Straighten</span>
              <input type="range" min={-15} max={15} disabled />
            </label>
            <div className="muted">Straighten is reserved for a future update.</div>
          </div>
        </div>
      )}

      {tool === 'adjust' && (
        <div className="panel">
          <div className="panel-title">Adjustments</div>
          <div className="panel-body muted">
            Brightness / contrast / curves coming next. The pipeline is ready for extensions.
          </div>
        </div>
      )}

      {bounds && (
        <div className="panel hint">
          <div className="panel-title">Shortcuts</div>
          <div className="panel-body">
            <div>Shift = Square</div>
            <div>Option/Alt = Symmetric resize</div>
            <div>Space + drag = Pan</div>
            <div>Enter = Apply crop</div>
            <div>Esc = Reset crop</div>
          </div>
        </div>
      )}

      <div className="panel">
        <div className="panel-title">Export</div>
        <div className="panel-body">
          <label className="field">
            <span>Format</span>
            <select
              value={exportFormat}
              onChange={(event) =>
                setExportFormat(event.target.value as 'image/png' | 'image/jpeg' | 'image/webp')
              }
              disabled={!image}
            >
              <option value="image/png">PNG</option>
              <option value="image/jpeg">JPEG</option>
              <option value="image/webp">WebP</option>
            </select>
          </label>
          <label className="field">
            <span>JPEG Quality</span>
            <input
              type="range"
              min={0.4}
              max={1}
              step={0.01}
              value={jpegQuality}
              disabled={!image || exportFormat !== 'image/jpeg'}
              onChange={(event) => setJpegQuality(Number(event.target.value))}
            />
          </label>
        </div>
      </div>

      {showDebug && (
        <div className="panel">
          <div className="panel-title">Debug</div>
          <div className="panel-body debug-log">
            {debugLog.length === 0 ? 'No events yet.' : debugLog.slice(-8).map((line) => (
              <div key={line}>{line}</div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
