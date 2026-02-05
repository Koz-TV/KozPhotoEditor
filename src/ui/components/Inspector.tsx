import type { Rect } from '../../core/types';
import type { AspectPreset, LoadedImage, Tool } from '../types';

const AspectOptions: { label: string; value: AspectPreset }[] = [
  { label: 'Free', value: 'free' },
  { label: '1:1', value: '1:1' },
  { label: '3:2', value: '3:2' },
  { label: '4:3', value: '4:3' },
  { label: '16:9', value: '16:9' },
  { label: 'Custom', value: 'custom' },
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
  aspectPreset: AspectPreset;
  onAspectPresetChange: (value: AspectPreset) => void;
  customAspect: { w: number; h: number };
  onCustomAspectChange: (value: { w: number; h: number }) => void;
  allowOutside: boolean;
  setAllowOutside: (value: boolean) => void;
  showGrid: boolean;
  setShowGrid: (value: boolean) => void;
  snapEnabled: boolean;
  setSnapEnabled: (value: boolean) => void;
  onApplyCrop: () => void;
  onResetCrop: () => void;
  onRotateLeft: () => void;
  onRotateRight: () => void;
  straighten: number;
  onStraightenChange: (value: number) => void;
  onBeginStraighten: () => void;
  onEndStraighten: () => void;
  flipH: boolean;
  flipV: boolean;
  onFlipH: () => void;
  onFlipV: () => void;
  adjustments: { brightness: number; contrast: number; curve: number };
  onAdjustmentsChange: (value: Partial<{ brightness: number; contrast: number; curve: number }>) => void;
  onBeginAdjust: () => void;
  onEndAdjust: () => void;
  onResetAdjustments: () => void;
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
  aspectPreset,
  onAspectPresetChange,
  customAspect,
  onCustomAspectChange,
  allowOutside,
  setAllowOutside,
  showGrid,
  setShowGrid,
  snapEnabled,
  setSnapEnabled,
  onApplyCrop,
  onResetCrop,
  onRotateLeft,
  onRotateRight,
  straighten,
  onStraightenChange,
  onBeginStraighten,
  onEndStraighten,
  flipH,
  flipV,
  onFlipH,
  onFlipV,
  adjustments,
  onAdjustmentsChange,
  onBeginAdjust,
  onEndAdjust,
  onResetAdjustments,
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
                value={aspectPreset}
                onChange={(event) =>
                  onAspectPresetChange(event.target.value as AspectPreset)
                }
                disabled={!image}
              >
                {AspectOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            {aspectPreset === 'custom' && (
              <div className="field-grid">
                <NumberField
                  label="Ratio W"
                  value={customAspect.w}
                  disabled={!image}
                  onChange={(value) =>
                    onCustomAspectChange({ ...customAspect, w: Math.max(1, value) })
                  }
                />
                <NumberField
                  label="Ratio H"
                  value={customAspect.h}
                  disabled={!image}
                  onChange={(value) =>
                    onCustomAspectChange({ ...customAspect, h: Math.max(1, value) })
                  }
                />
              </div>
            )}

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
                disabled={!image}
                onChange={(event) => setAllowOutside(event.target.checked)}
              />
              <span>Allow outside bounds</span>
            </label>
            <label className="toggle">
              <input
                type="checkbox"
                checked={snapEnabled}
                disabled={!image}
                onChange={(event) => setSnapEnabled(event.target.checked)}
              />
              <span>Snap to guides</span>
            </label>
            <label className="toggle">
              <input
                type="checkbox"
                checked={showGrid}
                disabled={!image}
                onChange={(event) => setShowGrid(event.target.checked)}
              />
              <span>Show thirds grid</span>
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
            <div className="panel-actions">
              <button
                className="btn"
                onClick={onFlipH}
                disabled={!image}
                aria-pressed={flipH}
              >
                Flip Horizontal
              </button>
              <button
                className="btn"
                onClick={onFlipV}
                disabled={!image}
                aria-pressed={flipV}
              >
                Flip Vertical
              </button>
            </div>
            <label className="field">
              <div className="field-row">
                <span>Straighten</span>
                <span className="field-value">{straighten.toFixed(1)}°</span>
              </div>
              <input
                type="range"
                min={-15}
                max={15}
                step={0.1}
                value={straighten}
                disabled={!image}
                onPointerDown={onBeginStraighten}
                onPointerUp={onEndStraighten}
                onPointerCancel={onEndStraighten}
                onBlur={onEndStraighten}
                onKeyDown={onBeginStraighten}
                onKeyUp={onEndStraighten}
                onChange={(event) => onStraightenChange(Number(event.target.value))}
              />
            </label>
          </div>
        </div>
      )}

      {tool === 'adjust' && (
        <div className="panel">
          <div className="panel-title">Adjustments</div>
          <div className="panel-body">
            <label className="field">
              <div className="field-row">
                <span>Brightness</span>
                <span className="field-value">{Math.round(adjustments.brightness * 100)}</span>
              </div>
              <input
                type="range"
                min={-1}
                max={1}
                step={0.01}
                value={adjustments.brightness}
                disabled={!image}
                onPointerDown={onBeginAdjust}
                onPointerUp={onEndAdjust}
                onPointerCancel={onEndAdjust}
                onBlur={onEndAdjust}
                onKeyDown={onBeginAdjust}
                onKeyUp={onEndAdjust}
                onChange={(event) => onAdjustmentsChange({ brightness: Number(event.target.value) })}
              />
            </label>
            <label className="field">
              <div className="field-row">
                <span>Contrast</span>
                <span className="field-value">{Math.round(adjustments.contrast * 100)}</span>
              </div>
              <input
                type="range"
                min={-1}
                max={1}
                step={0.01}
                value={adjustments.contrast}
                disabled={!image}
                onPointerDown={onBeginAdjust}
                onPointerUp={onEndAdjust}
                onPointerCancel={onEndAdjust}
                onBlur={onEndAdjust}
                onKeyDown={onBeginAdjust}
                onKeyUp={onEndAdjust}
                onChange={(event) => onAdjustmentsChange({ contrast: Number(event.target.value) })}
              />
            </label>
            <label className="field">
              <div className="field-row">
                <span>Tone Curve</span>
                <span className="field-value">{Math.round(adjustments.curve * 100)}</span>
              </div>
              <input
                type="range"
                min={-1}
                max={1}
                step={0.01}
                value={adjustments.curve}
                disabled={!image}
                onPointerDown={onBeginAdjust}
                onPointerUp={onEndAdjust}
                onPointerCancel={onEndAdjust}
                onBlur={onEndAdjust}
                onKeyDown={onBeginAdjust}
                onKeyUp={onEndAdjust}
                onChange={(event) => onAdjustmentsChange({ curve: Number(event.target.value) })}
              />
            </label>
            <div className="panel-actions">
              <button className="btn" onClick={onResetAdjustments} disabled={!image}>
                Reset Adjustments
              </button>
            </div>
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
