import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './App.css';
import { CanvasView } from './ui/components/CanvasView';
import { Inspector } from './ui/components/Inspector';
import { StatusBar } from './ui/components/StatusBar';
import { Toolbar } from './ui/components/Toolbar';
import type { Rect, Rotation, TransformState } from './core/types';
import { clampRectEdges } from './core/geometry';
import { createHistory, pushHistory, redoHistory, undoHistory } from './core/history';
import { getOrientedSize, rotateRect } from './core/crop';
import { exportTransformedImage, type ExportFormat } from './core/transform';
import type { LoadedImage, Tool, ViewState } from './ui/types';
import { isTauri } from './platform/fileIO';
import { loadImageFromFile } from './platform/image';
import { downloadBlob } from './platform/webFileIO';
import { loadImageFromPath, openImageDialog, saveExportDialog } from './platform/tauriFileIO';

const initialTransform: TransformState = {
  cropRect: null,
  rotation: 0,
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

const App = () => {
  const [tool, setTool] = useState<Tool>('crop');
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [image, setImage] = useState<LoadedImage | null>(null);
  const [history, setHistory] = useState(() => createHistory(initialTransform));
  const [cropRect, setCropRectState] = useState<Rect | null>(null);
  const [allowOutside, setAllowOutside] = useState(false);
  const [aspectRatio, setAspectRatio] = useState<number | null>(null);
  const [view, setView] = useState<ViewState>({ zoom: 1, pan: { x: 0, y: 0 } });
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [debugLog, setDebugLog] = useState<string[]>([]);
  const [exportFormat, setExportFormat] = useState<ExportFormat>('image/png');
  const [jpegQuality, setJpegQuality] = useState(0.92);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCounter = useRef(0);

  const transform = history.present;
  const orientedSize = useMemo(() => {
    if (!image) return { w: 0, h: 0 };
    return getOrientedSize(image.width, image.height, transform.rotation);
  }, [image, transform.rotation]);
  const appliedCropRect = transform.cropRect;
  const displaySize = useMemo(() => {
    if (appliedCropRect) return { w: appliedCropRect.w, h: appliedCropRect.h };
    return { w: orientedSize.w, h: orientedSize.h };
  }, [appliedCropRect, orientedSize.w, orientedSize.h]);

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
          w: orientedSize.w,
          h: orientedSize.h,
        };
        setCropRectState(clampRectEdges(rect, bounds));
        return;
      }
      setCropRectState(rect);
    },
    [allowOutside, image, orientedSize.w, orientedSize.h, appliedCropRect]
  );

  const resetImageState = useCallback((nextImage: LoadedImage) => {
    setImage(nextImage);
    setHistory(createHistory(initialTransform));
    setCropRectState(null);
    setAllowOutside(false);
    setAspectRatio(null);
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
        w: orientedSize.w,
        h: orientedSize.h,
      };
      setCropRectState(clampRectEdges(cropRect, bounds));
    }
  }, [allowOutside, cropRect, image, orientedSize.w, orientedSize.h, appliedCropRect]);

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
      const current = history.present;
      const oriented = getOrientedSize(image.width, image.height, current.rotation);
      const rotateDelta = delta === 90 ? 90 : 270;
      const nextRotation = normalizeRotation(current.rotation + delta);
      const nextCrop = current.cropRect
        ? rotateRect(current.cropRect, rotateDelta as Rotation, oriented.w, oriented.h)
        : null;
      const nextDraft = cropRect
        ? rotateRect(cropRect, rotateDelta as Rotation, oriented.w, oriented.h)
        : null;

      setHistory((prev) => pushHistory(prev, { ...prev.present, rotation: nextRotation, cropRect: nextCrop }));
      setCropRectState(nextDraft);
    },
    [image, history.present, cropRect]
  );

  const handleUndo = useCallback(() => {
    setHistory((prev) => {
      const next = undoHistory(prev);
      setCropRectState(null);
      return next;
    });
  }, []);

  const handleRedo = useCallback(() => {
    setHistory((prev) => {
      const next = redoHistory(prev);
      setCropRectState(null);
      return next;
    });
  }, []);

  const handleExport = useCallback(async () => {
    if (!image) return;
    const exportTransform = {
      ...history.present,
      cropRect: cropRect ?? history.present.cropRect,
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
  }, [image, history.present, cropRect, exportFormat, jpegQuality]);

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
        appliedCropRect={appliedCropRect}
        isLoading={isLoading}
        isDragging={isDragging}
        errorMessage={loadError}
        onApplyCrop={applyCrop}
        isSpacePressed={isSpacePressed}
      />

      <Inspector
        tool={tool}
        image={image}
        cropRect={cropRect ?? appliedCropRect}
        setCropRect={setCropRect}
        aspectRatio={aspectRatio}
        setAspectRatio={setAspectRatio}
        allowOutside={allowOutside}
        setAllowOutside={setAllowOutside}
        onApplyCrop={applyCrop}
        onResetCrop={resetCrop}
        onRotateLeft={() => rotateBy(-90)}
        onRotateRight={() => rotateBy(90)}
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
