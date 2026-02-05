import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './App.css';
import { CanvasView } from './ui/components/CanvasView';
import { Inspector } from './ui/components/Inspector';
import { StatusBar } from './ui/components/StatusBar';
import { Toolbar } from './ui/components/Toolbar';
import type { Rect, Rotation, TransformState } from './core/types';
import { clampRectEdges, rotatedBounds } from './core/geometry';
import { createHistory, pushHistory, redoHistory, undoHistory } from './core/history';
import { getOrientedSize, rotateRect } from './core/crop';
import { exportTransformedImage, type ExportFormat } from './core/transform';
import { isDefaultAdjustments, normalizeAdjustments } from './core/adjustments';
import type { AspectPreset, LoadedImage, Tool, ViewState } from './ui/types';
import { isTauri } from './platform/fileIO';
import { loadImageFromFile } from './platform/image';
import { downloadBlob } from './platform/webFileIO';
import { loadImageFromPath, openImageDialog, saveExportDialog } from './platform/tauriFileIO';

const initialTransform: TransformState = {
  cropRect: null,
  rotation: 0,
  straighten: 0,
  flipH: false,
  flipV: false,
  adjustments: { brightness: 0, contrast: 0, curve: 0 },
};

const normalizeRotation = (rotation: number): Rotation => {
  const normalized = ((rotation % 360) + 360) % 360;
  return (normalized === 90 || normalized === 180 || normalized === 270
    ? normalized
    : 0) as Rotation;
};

const getDefaultExportName = (name: string | undefined, format: ExportFormat) => {
  const ext = format === 'image/jpeg' ? 'jpg' : format === 'image/webp' ? 'webp' : 'png';
  const base = name ? name.replace(/\.[^/.]+$/, '') : 'export';
  return `${base}.${ext}`;
};

const ASPECT_PRESETS: Record<AspectPreset, number | null> = {
  free: null,
  '1:1': 1,
  '3:2': 3 / 2,
  '4:3': 4 / 3,
  '16:9': 16 / 9,
  custom: null,
};

const App = () => {
  const [tool, setTool] = useState<Tool>('crop');
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [image, setImage] = useState<LoadedImage | null>(null);
  const [history, setHistory] = useState(() => createHistory(initialTransform));
  const [cropRect, setCropRectState] = useState<Rect | null>(null);
  const [allowOutside, setAllowOutside] = useState(false);
  const [aspectPreset, setAspectPreset] = useState<AspectPreset>('free');
  const [customAspect, setCustomAspect] = useState({ w: 3, h: 2 });
  const [view, setView] = useState<ViewState>({ zoom: 1, pan: { x: 0, y: 0 } });
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const [showGrid, setShowGrid] = useState(true);
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [debugLog, setDebugLog] = useState<string[]>([]);
  const [exportFormat, setExportFormat] = useState<ExportFormat>('image/png');
  const [jpegQuality, setJpegQuality] = useState(0.92);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCounter = useRef(0);
  const adjustBaseRef = useRef<TransformState | null>(null);
  const straightenBaseRef = useRef<TransformState | null>(null);

  const transform = useMemo(() => {
    const raw = history.present as TransformState & { adjustments?: TransformState['adjustments'] };
    return {
      ...raw,
      adjustments: normalizeAdjustments(raw.adjustments),
    };
  }, [history.present]);
  const aspectRatio = useMemo(() => {
    if (aspectPreset === 'custom') {
      const ratio = customAspect.w > 0 && customAspect.h > 0
        ? customAspect.w / customAspect.h
        : null;
      return ratio && Number.isFinite(ratio) ? ratio : null;
    }
    return ASPECT_PRESETS[aspectPreset];
  }, [aspectPreset, customAspect.h, customAspect.w]);
  const orientedSize = useMemo(() => {
    if (!image) return { w: 0, h: 0 };
    return getOrientedSize(image.width, image.height, transform.rotation);
  }, [image, transform.rotation]);
  const displayBounds = useMemo(() => {
    if (!image) return { w: 0, h: 0 };
    return rotatedBounds(orientedSize.w, orientedSize.h, transform.straighten);
  }, [image, orientedSize.w, orientedSize.h, transform.straighten]);
  const appliedCropRect = transform.cropRect;
  const displaySize = useMemo(() => {
    if (appliedCropRect) return { w: appliedCropRect.w, h: appliedCropRect.h };
    return { w: displayBounds.w, h: displayBounds.h };
  }, [appliedCropRect, displayBounds.w, displayBounds.h]);
  const adjustmentsActive = useMemo(
    () => !isDefaultAdjustments(transform.adjustments),
    [transform.adjustments]
  );

  const setCropRect = useCallback(
    (rect: Rect | null) => {
      if (!rect) {
        setCropRectState(null);
        return;
      }
      if (!allowOutside && image) {
        const bounds = appliedCropRect ?? {
          x: 0,
          y: 0,
          w: displayBounds.w,
          h: displayBounds.h,
        };
        setCropRectState(clampRectEdges(rect, bounds));
        return;
      }
      setCropRectState(rect);
    },
    [allowOutside, image, displayBounds.w, displayBounds.h, appliedCropRect]
  );

  const resetImageState = useCallback((nextImage: LoadedImage) => {
    setImage(nextImage);
    setHistory(createHistory(initialTransform));
    setCropRectState(null);
    setAllowOutside(false);
    setAspectPreset('free');
    setCustomAspect({ w: 3, h: 2 });
    setShowGrid(true);
    setSnapEnabled(true);
    adjustBaseRef.current = null;
    straightenBaseRef.current = null;
    setTool('crop');
    setLoadError(null);
  }, []);

  const pushLog = useCallback((message: string) => {
    const entry = `${new Date().toLocaleTimeString()} — ${message}`;
    console.log(entry);
    setDebugLog((prev) => {
      const next = [...prev, entry];
      return next.slice(-60);
    });
  }, []);

  const fitToScreen = useCallback(() => {
    if (!image || viewport.width === 0 || viewport.height === 0) return;
    const padding = 120;
    const availableW = Math.max(1, viewport.width - padding);
    const availableH = Math.max(1, viewport.height - padding);
    const zoom = Math.min(availableW / displaySize.w, availableH / displaySize.h);
    setView({ zoom: Math.max(0.05, Math.min(zoom, 8)), pan: { x: 0, y: 0 } });
  }, [image, viewport.width, viewport.height, displaySize.w, displaySize.h]);

  useEffect(() => {
    if (image && viewport.width > 0 && viewport.height > 0) {
      fitToScreen();
    }
  }, [image, viewport.width, viewport.height, fitToScreen]);

  useEffect(() => {
    if (!allowOutside && cropRect && image) {
      const bounds = appliedCropRect ?? {
        x: 0,
        y: 0,
        w: displayBounds.w,
        h: displayBounds.h,
      };
      setCropRectState(clampRectEdges(cropRect, bounds));
    }
  }, [allowOutside, cropRect, image, displayBounds.w, displayBounds.h, appliedCropRect]);

  useEffect(() => {
    if (appliedCropRect) {
      fitToScreen();
    }
  }, [appliedCropRect, fitToScreen]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  const handleOpen = useCallback(async () => {
    if (isTauri()) {
      setIsLoading(true);
      setLoadError(null);
      pushLog('Open dialog: start');
      try {
        const opened = await openImageDialog();
        if (opened) {
          pushLog(`Open dialog: loaded ${opened.name}`);
          resetImageState(opened);
        } else {
          pushLog('Open dialog: cancelled');
        }
        if (!opened) setIsLoading(false);
      } finally {
        setIsLoading(false);
      }
      return;
    }
    fileInputRef.current?.click();
  }, [resetImageState]);

  const handleFileChange = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;
      setIsLoading(true);
      setLoadError(null);
      pushLog(`File input: ${file.name}`);
      try {
        const loaded = await loadImageFromFile(file);
        resetImageState(loaded);
      } catch (error) {
        setLoadError(
          `Failed to open file. ${error instanceof Error ? error.message : 'Unsupported file.'}`
        );
        pushLog(`File input error: ${String(error)}`);
      } finally {
        setIsLoading(false);
      }
      event.target.value = '';
    },
    [resetImageState]
  );

  const handleDrop = useCallback(
    async (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      const file = event.dataTransfer.files?.[0];
      if (!file) return;
      setIsDragging(false);
      setIsLoading(true);
      setLoadError(null);
      pushLog(`HTML5 drop: ${file.name}`);
      try {
        const loaded = await loadImageFromFile(file);
        resetImageState(loaded);
      } catch (error) {
        setLoadError(
          `Failed to open file. ${error instanceof Error ? error.message : 'Unsupported file.'}`
        );
        pushLog(`HTML5 drop error: ${String(error)}`);
      } finally {
        setIsLoading(false);
      }
    },
    [resetImageState]
  );

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
  };

  const handleDragEnter = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    dragCounter.current += 1;
    setIsDragging(true);
    pushLog('HTML5 drag enter');
  };

  const handleDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    dragCounter.current = Math.max(0, dragCounter.current - 1);
    if (dragCounter.current === 0) {
      setIsDragging(false);
    }
    pushLog('HTML5 drag leave');
  };

  const applyCrop = useCallback(() => {
    if (!cropRect) return;
    setHistory((prev) => {
      const next = pushHistory(prev, { ...prev.present, cropRect });
      return next;
    });
    setCropRectState(null);
  }, [cropRect]);

  const resetCrop = useCallback(() => {
    if (!image) return;
    if (appliedCropRect) {
      setHistory((prev) => pushHistory(prev, { ...prev.present, cropRect: null }));
      setCropRectState(null);
      return;
    }
    setCropRectState(null);
  }, [image, appliedCropRect]);

  const rotateBy = useCallback(
    (delta: 90 | -90) => {
      if (!image) return;
      const rotateDelta = delta === 90 ? 90 : 270;
      const nextRotation = normalizeRotation(transform.rotation + delta);
      const nextCrop = transform.cropRect
        ? rotateRect(transform.cropRect, rotateDelta as Rotation, displayBounds.w, displayBounds.h)
        : null;
      const nextDraft = cropRect
        ? rotateRect(cropRect, rotateDelta as Rotation, displayBounds.w, displayBounds.h)
        : null;

      setHistory((prev) =>
        pushHistory(prev, { ...prev.present, rotation: nextRotation, cropRect: nextCrop })
      );
      setCropRectState(nextDraft);
    },
    [image, transform.rotation, transform.cropRect, cropRect, displayBounds.w, displayBounds.h]
  );

  const beginAdjustments = useCallback(() => {
    if (!adjustBaseRef.current) {
      adjustBaseRef.current = history.present;
    }
  }, [history.present]);

  const commitAdjustments = useCallback(() => {
    setHistory((prev) => {
      const base = adjustBaseRef.current;
      adjustBaseRef.current = null;
      if (!base) return prev;
      const baseAdj = normalizeAdjustments(base.adjustments);
      const nextAdj = normalizeAdjustments(prev.present.adjustments);
      const same =
        baseAdj.brightness === nextAdj.brightness &&
        baseAdj.contrast === nextAdj.contrast &&
        baseAdj.curve === nextAdj.curve;
      if (same) return prev;
      return {
        past: [...prev.past, base],
        present: prev.present,
        future: [],
      };
    });
  }, []);

  const updateAdjustments = useCallback((updates: Partial<TransformState['adjustments']>) => {
    if (!adjustBaseRef.current) {
      adjustBaseRef.current = history.present;
    }
    setHistory((prev) => ({
      past: prev.past,
      present: {
        ...prev.present,
        adjustments: { ...normalizeAdjustments(prev.present.adjustments), ...updates },
      },
      future: [],
    }));
  }, [history.present]);

  const resetAdjustments = useCallback(() => {
    setHistory((prev) =>
      pushHistory(prev, {
        ...prev.present,
        adjustments: { brightness: 0, contrast: 0, curve: 0 },
      })
    );
  }, []);

  const updateTransform = useCallback((updates: Partial<TransformState>) => {
    setHistory((prev) => ({
      past: prev.past,
      present: {
        ...prev.present,
        adjustments: normalizeAdjustments(prev.present.adjustments),
        ...updates,
      },
      future: [],
    }));
  }, []);

  const beginStraighten = useCallback(() => {
    if (!straightenBaseRef.current) {
      straightenBaseRef.current = history.present;
    }
  }, [history.present]);

  const commitStraighten = useCallback(() => {
    setHistory((prev) => {
      const base = straightenBaseRef.current;
      straightenBaseRef.current = null;
      if (!base) return prev;
      if (base.straighten === prev.present.straighten) return prev;
      return {
        past: [...prev.past, base],
        present: prev.present,
        future: [],
      };
    });
  }, []);

  const handleStraightenChange = useCallback(
    (value: number) => {
      if (!straightenBaseRef.current) {
        straightenBaseRef.current = history.present;
      }
      updateTransform({ straighten: value });
    },
    [history.present, updateTransform]
  );

  const handleFlipH = useCallback(() => {
    setHistory((prev) =>
      pushHistory(prev, { ...prev.present, flipH: !prev.present.flipH })
    );
  }, []);

  const handleFlipV = useCallback(() => {
    setHistory((prev) =>
      pushHistory(prev, { ...prev.present, flipV: !prev.present.flipV })
    );
  }, []);

  const handleAspectPresetChange = useCallback((value: AspectPreset) => {
    setAspectPreset(value);
  }, []);

  const handleCustomAspectChange = useCallback((next: { w: number; h: number }) => {
    setCustomAspect(next);
    setAspectPreset('custom');
  }, []);

  const resetView = useCallback(() => {
    setView((prev) => ({ ...prev, pan: { x: 0, y: 0 } }));
  }, []);

  const zoomTo100 = useCallback(() => {
    setView({ zoom: 1, pan: { x: 0, y: 0 } });
  }, []);

  const handleUndo = useCallback(() => {
    setHistory((prev) => {
      const next = undoHistory(prev);
      setCropRectState(null);
      return next;
    });
    adjustBaseRef.current = null;
    straightenBaseRef.current = null;
  }, []);

  const handleRedo = useCallback(() => {
    setHistory((prev) => {
      const next = redoHistory(prev);
      setCropRectState(null);
      return next;
    });
    adjustBaseRef.current = null;
    straightenBaseRef.current = null;
  }, []);

  const handleExport = useCallback(async () => {
    if (!image) return;
    const exportTransform = {
      ...transform,
      cropRect: cropRect ?? transform.cropRect,
    };
    const blob = await exportTransformedImage({
      image: image.bitmap,
      transform: exportTransform,
      format: exportFormat,
      quality: exportFormat === 'image/jpeg' ? jpegQuality : undefined,
    });

    const defaultName = getDefaultExportName(image.name, exportFormat);

    if (isTauri()) {
      await saveExportDialog({ blob, defaultName, mimeType: exportFormat });
    } else {
      await downloadBlob({ blob, defaultName, mimeType: exportFormat });
    }
  }, [image, transform, cropRect, exportFormat, jpegQuality]);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;

      if (event.key === ' ') {
        event.preventDefault();
        setIsSpacePressed(true);
      }

      if (event.key === 'Escape') {
        if (cropRect) {
          setCropRectState(null);
        }
      }

      if (event.key === 'Enter') {
        if (tool === 'crop') {
          applyCrop();
        }
      }

      if (!event.metaKey && !event.ctrlKey && !event.altKey) {
        if (event.key.toLowerCase() === 'h') {
          setTool('hand');
        }
      }

      const isModifier = event.metaKey || event.ctrlKey;
      if (isModifier && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        if (event.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
      }
    },
    [applyCrop, cropRect, handleRedo, handleUndo, tool]
  );

  const handleKeyUp = useCallback((event: KeyboardEvent) => {
    if (event.key === ' ') {
      setIsSpacePressed(false);
    }
  }, []);

  const handleBlur = useCallback(() => {
    setIsSpacePressed(false);
  }, []);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
    };
  }, [handleKeyDown, handleKeyUp, handleBlur]);

  useEffect(() => {
    pushLog(`env: isTauri=${isTauri()}`);
  }, [pushLog]);

  useEffect(() => {
    if (!isTauri()) return;
    let unlisten: (() => void) | null = null;
    let alive = true;

    const setup = async () => {
      const { getCurrentWindow } = await import('@tauri-apps/api/window');
      pushLog('Tauri drag-drop: listener attached');
      unlisten = await getCurrentWindow().onDragDropEvent(async (event) => {
        if (!alive) return;
        pushLog(`Tauri drag event: ${event.payload.type}`);
        if (event.payload.type === 'enter' || event.payload.type === 'over') {
          setIsDragging(true);
        } else if (event.payload.type === 'leave') {
          setIsDragging(false);
        } else if (event.payload.type === 'drop') {
          setIsDragging(false);
          const path = event.payload.paths?.[0];
          if (!path) return;
          setIsLoading(true);
          setLoadError(null);
          pushLog(`Tauri drop path: ${path}`);
          try {
            const loaded = await loadImageFromPath(path);
            resetImageState(loaded);
          } catch (error) {
            setLoadError(
              `Failed to open file. ${error instanceof Error ? error.message : 'Check permissions.'}`
            );
            pushLog(`Tauri drop error: ${String(error)}`);
          } finally {
            setIsLoading(false);
          }
        }
      });
    };

    setup();
    return () => {
      alive = false;
      if (unlisten) unlisten();
    };
  }, [resetImageState, pushLog]);

  return (
    <div
      className="app"
      data-crop-active={Boolean(cropRect)}
      data-crop-applied={Boolean(appliedCropRect)}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
    >
      <Toolbar
        tool={tool}
        onToolChange={setTool}
        onOpen={handleOpen}
        onExport={handleExport}
        onRotateLeft={() => rotateBy(-90)}
        onRotateRight={() => rotateBy(90)}
        onUndo={handleUndo}
        onRedo={handleRedo}
        canUndo={history.past.length > 0}
        canRedo={history.future.length > 0}
        onResetAdjustments={resetAdjustments}
        adjustmentsActive={adjustmentsActive}
        canExport={Boolean(image)}
      />

      <CanvasView
        image={image}
        view={view}
        onViewChange={setView}
        onViewportChange={setViewport}
        tool={tool}
        cropRect={cropRect}
        setCropRect={setCropRect}
        allowOutside={allowOutside}
        aspectRatio={aspectRatio}
        rotation={transform.rotation}
        straighten={transform.straighten}
        flipH={transform.flipH}
        flipV={transform.flipV}
        adjustments={transform.adjustments}
        appliedCropRect={appliedCropRect}
        isLoading={isLoading}
        isDragging={isDragging}
        errorMessage={loadError}
        onApplyCrop={applyCrop}
        isSpacePressed={isSpacePressed}
        showGrid={showGrid}
        snapEnabled={snapEnabled}
      />

      <Inspector
        tool={tool}
        image={image}
        cropRect={cropRect ?? appliedCropRect}
        setCropRect={setCropRect}
        aspectPreset={aspectPreset}
        onAspectPresetChange={handleAspectPresetChange}
        customAspect={customAspect}
        onCustomAspectChange={handleCustomAspectChange}
        allowOutside={allowOutside}
        setAllowOutside={setAllowOutside}
        showGrid={showGrid}
        setShowGrid={setShowGrid}
        snapEnabled={snapEnabled}
        setSnapEnabled={setSnapEnabled}
        onApplyCrop={applyCrop}
        onResetCrop={resetCrop}
        onRotateLeft={() => rotateBy(-90)}
        onRotateRight={() => rotateBy(90)}
        straighten={transform.straighten}
        onStraightenChange={handleStraightenChange}
        onBeginStraighten={beginStraighten}
        onEndStraighten={commitStraighten}
        flipH={transform.flipH}
        flipV={transform.flipV}
        onFlipH={handleFlipH}
        onFlipV={handleFlipV}
        adjustments={transform.adjustments}
        onAdjustmentsChange={updateAdjustments}
        onBeginAdjust={beginAdjustments}
        onEndAdjust={commitAdjustments}
        onResetAdjustments={resetAdjustments}
        exportFormat={exportFormat}
        setExportFormat={setExportFormat}
        jpegQuality={jpegQuality}
        setJpegQuality={setJpegQuality}
        debugLog={debugLog}
        showDebug={import.meta.env.DEV}
      />

      <StatusBar
        image={image}
        zoom={view.zoom}
        onZoomIn={() => setView((prev) => ({ ...prev, zoom: Math.min(prev.zoom * 1.1, 8) }))}
        onZoomOut={() => setView((prev) => ({ ...prev, zoom: Math.max(prev.zoom * 0.9, 0.1) }))}
        onZoomFit={fitToScreen}
        onZoomReset={resetView}
        onZoom100={zoomTo100}
        theme={theme}
        onToggleTheme={() => setTheme((prev) => (prev === 'light' ? 'dark' : 'light'))}
      />

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />
    </div>
  );
};

export default App;
