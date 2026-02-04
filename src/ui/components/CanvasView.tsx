import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Guide } from '../utils/snap';
import { snapRect } from '../utils/snap';
import type { Handle, Rect, Rotation, Vec2 } from '../../core/types';
import {
  getOrientedSize,
  moveCropRect,
  resizeCropRect,
} from '../../core/crop';
import { clampRectEdges, rectFromPointsWithAspect } from '../../core/geometry';
import type { LoadedImage, ViewState } from '../types';
import { useResizeObserver } from '../utils/useResizeObserver';

const HANDLE_SIZE = 8;
const HANDLE_HIT = 10;

const handlePositions = (rect: Rect) => {
  const { x, y, w, h } = rect;
  const cx = x + w / 2;
  const cy = y + h / 2;
  return [
    { handle: 'nw' as Handle, x, y },
    { handle: 'n' as Handle, x: cx, y },
    { handle: 'ne' as Handle, x: x + w, y },
    { handle: 'e' as Handle, x: x + w, y: cy },
    { handle: 'se' as Handle, x: x + w, y: y + h },
    { handle: 's' as Handle, x: cx, y: y + h },
    { handle: 'sw' as Handle, x, y: y + h },
    { handle: 'w' as Handle, x, y: cy },
  ];
};

const cursorForHandle = (handle: Handle) => {
  switch (handle) {
    case 'n':
    case 's':
      return 'ns-resize';
    case 'e':
    case 'w':
      return 'ew-resize';
    case 'ne':
    case 'sw':
      return 'nesw-resize';
    case 'nw':
    case 'se':
      return 'nwse-resize';
    default:
      return 'default';
  }
};

type DragState =
  | {
      type: 'creating';
      startImg: Vec2;
      aspect: number | null;
    }
  | {
      type: 'moving';
      startImg: Vec2;
      startRect: Rect;
    }
  | {
      type: 'resizing';
      startImg: Vec2;
      startRect: Rect;
      handle: Handle;
    }
  | {
      type: 'panning';
      startScreen: Vec2;
      startPan: Vec2;
    };

export type CanvasViewProps = {
  image: LoadedImage | null;
  view: ViewState;
  onViewChange: (view: ViewState) => void;
  onViewportChange: (size: { width: number; height: number }) => void;
  tool: 'crop' | 'rotate' | 'adjust';
  cropRect: Rect | null;
  setCropRect: (rect: Rect | null) => void;
  allowOutside: boolean;
  aspectRatio: number | null;
  rotation: Rotation;
  appliedCropRect: Rect | null;
  isLoading: boolean;
  isDragging: boolean;
  errorMessage: string | null;
  onApplyCrop: () => void;
  isSpacePressed: boolean;
};

export const CanvasView = ({
  image,
  view,
  onViewChange,
  onViewportChange,
  tool,
  cropRect,
  setCropRect,
  allowOutside,
  aspectRatio,
  rotation,
  appliedCropRect,
  isLoading,
  isDragging,
  errorMessage,
  onApplyCrop,
  isSpacePressed,
}: CanvasViewProps) => {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const patternRef = useRef<CanvasPattern | null>(null);
  const [hoverHandle, setHoverHandle] = useState<Handle | null>(null);
  const [hoverInside, setHoverInside] = useState(false);
  const [guides, setGuides] = useState<Guide[]>([]);

  const size = useResizeObserver(wrapperRef);

  useEffect(() => {
    onViewportChange(size);
  }, [size, onViewportChange]);

  const orientedSize = useMemo(() => {
    if (!image) return { w: 0, h: 0 };
    return getOrientedSize(image.width, image.height, rotation);
  }, [image, rotation]);

  const activeBounds = useMemo(() => {
    if (appliedCropRect) return appliedCropRect;
    return { x: 0, y: 0, w: orientedSize.w, h: orientedSize.h };
  }, [appliedCropRect, orientedSize.w, orientedSize.h]);

  const imageOrigin = useCallback(() => {
    const baseX = (size.width - activeBounds.w * view.zoom) / 2 + view.pan.x;
    const baseY = (size.height - activeBounds.h * view.zoom) / 2 + view.pan.y;
    return {
      x: baseX - activeBounds.x * view.zoom,
      y: baseY - activeBounds.y * view.zoom,
    };
  }, [
    size.width,
    size.height,
    activeBounds.w,
    activeBounds.h,
    activeBounds.x,
    activeBounds.y,
    view.zoom,
    view.pan,
  ]);

  const screenToImage = useCallback(
    (point: Vec2) => {
      const origin = imageOrigin();
      return {
        x: (point.x - origin.x) / view.zoom,
        y: (point.y - origin.y) / view.zoom,
      };
    },
    [imageOrigin, view.zoom]
  );

  const imageToScreen = useCallback(
    (point: Vec2) => {
      const origin = imageOrigin();
      return {
        x: origin.x + point.x * view.zoom,
        y: origin.y + point.y * view.zoom,
      };
    },
    [imageOrigin, view.zoom]
  );

  const getHandleAtPoint = useCallback(
    (point: Vec2) => {
      if (!cropRect) return null;
      const rectScreen = {
        x: imageToScreen({ x: cropRect.x, y: cropRect.y }).x,
        y: imageToScreen({ x: cropRect.x, y: cropRect.y }).y,
        w: cropRect.w * view.zoom,
        h: cropRect.h * view.zoom,
      };
      for (const handle of handlePositions(rectScreen)) {
        if (
          Math.abs(point.x - handle.x) <= HANDLE_HIT &&
          Math.abs(point.y - handle.y) <= HANDLE_HIT
        ) {
          return handle.handle;
        }
      }
      return null;
    },
    [cropRect, imageToScreen, view.zoom]
  );

  const isPointInRect = (point: Vec2, rect: Rect) =>
    point.x >= rect.x &&
    point.x <= rect.x + rect.w &&
    point.y >= rect.y &&
    point.y <= rect.y + rect.h;

  const onPointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!image) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.setPointerCapture(event.pointerId);

    const rect = canvas.getBoundingClientRect();
    const screenPoint = { x: event.clientX - rect.left, y: event.clientY - rect.top };
    const imgPoint = screenToImage(screenPoint);

    if (isSpacePressed) {
      dragRef.current = {
        type: 'panning',
        startScreen: screenPoint,
        startPan: { ...view.pan },
      };
      return;
    }

    if (tool !== 'crop') return;

    const bounds = activeBounds;

    if (!allowOutside && !isPointInRect(imgPoint, bounds)) {
      return;
    }

    const handle = getHandleAtPoint(screenPoint);
    if (handle && cropRect) {
      dragRef.current = {
        type: 'resizing',
        startImg: imgPoint,
        startRect: cropRect,
        handle,
      };
      return;
    }

    if (cropRect && isPointInRect(imgPoint, cropRect)) {
      dragRef.current = {
        type: 'moving',
        startImg: imgPoint,
        startRect: cropRect,
      };
      return;
    }

    const aspect = event.shiftKey ? 1 : aspectRatio;
    dragRef.current = {
      type: 'creating',
      startImg: imgPoint,
      aspect: aspect ?? null,
    };
    setCropRect({ x: imgPoint.x, y: imgPoint.y, w: 1, h: 1 });
  };

  const onPointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!image) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const screenPoint = { x: event.clientX - rect.left, y: event.clientY - rect.top };
    const imgPoint = screenToImage(screenPoint);

    if (!dragRef.current) {
      const handle = getHandleAtPoint(screenPoint);
      setHoverHandle(handle);
      if (cropRect) {
        setHoverInside(isPointInRect(imgPoint, cropRect));
      } else {
        setHoverInside(false);
      }
      return;
    }

    const bounds = activeBounds;
    const threshold = 8 / Math.max(0.25, view.zoom);

    if (dragRef.current.type === 'panning') {
      const delta = {
        x: screenPoint.x - dragRef.current.startScreen.x,
        y: screenPoint.y - dragRef.current.startScreen.y,
      };
      onViewChange({
        zoom: view.zoom,
        pan: {
          x: dragRef.current.startPan.x + delta.x,
          y: dragRef.current.startPan.y + delta.y,
        },
      });
      return;
    }

    if (dragRef.current.type === 'creating') {
      const aspect = event.shiftKey ? 1 : dragRef.current.aspect;
      let next = rectFromPointsWithAspect(dragRef.current.startImg, imgPoint, aspect);
      if (!allowOutside) {
        next = clampRectEdges(next, bounds);
      }
      setCropRect(next);
      return;
    }

    if (!cropRect) return;

    if (dragRef.current.type === 'moving') {
      const delta = {
        x: imgPoint.x - dragRef.current.startImg.x,
        y: imgPoint.y - dragRef.current.startImg.y,
      };
      let next = moveCropRect(dragRef.current.startRect, delta, bounds, allowOutside);
      const snapped = snapRect(next, bounds, threshold, 'move');
      next = snapped.rect;
      setGuides(snapped.guides);
      setCropRect(next);
      return;
    }

    if (dragRef.current.type === 'resizing') {
      const delta = {
        x: imgPoint.x - dragRef.current.startImg.x,
        y: imgPoint.y - dragRef.current.startImg.y,
      };
      const aspect = event.shiftKey ? 1 : aspectRatio;
      let next = resizeCropRect(
        dragRef.current.startRect,
        dragRef.current.handle,
        delta,
        {
          square: aspect === 1,
          symmetric: event.altKey,
          aspectRatio: aspect && aspect !== 1 ? aspect : null,
        },
        bounds,
        allowOutside
      );
      const snapped = snapRect(next, bounds, threshold, 'resize', dragRef.current.handle);
      next = snapped.rect;
      setGuides(snapped.guides);
      setCropRect(next);
      return;
    }
  };

  const onPointerUp = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.releasePointerCapture(event.pointerId);
    }
    dragRef.current = null;
    setGuides([]);
  };

  const onWheel = (event: React.WheelEvent<HTMLCanvasElement>) => {
    if (!image) return;
    event.preventDefault();

    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();

    const zoomFactor = event.deltaY < 0 ? 1.08 : 0.92;
    const nextZoom = Math.max(0.1, Math.min(8, view.zoom * zoomFactor));
    const cursor = { x: event.clientX - rect.left, y: event.clientY - rect.top };
    const imgPoint = screenToImage(cursor);

    const nextOrigin = {
      x: cursor.x - imgPoint.x * nextZoom,
      y: cursor.y - imgPoint.y * nextZoom,
    };

    const nextPan = {
      x: nextOrigin.x - (size.width - activeBounds.w * nextZoom) / 2,
      y: nextOrigin.y - (size.height - activeBounds.h * nextZoom) / 2,
    };

    onViewChange({ zoom: nextZoom, pan: nextPan });
  };

  const onDoubleClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!cropRect) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const imgPoint = screenToImage({ x: event.clientX - rect.left, y: event.clientY - rect.top });
    if (isPointInRect(imgPoint, cropRect)) {
      onApplyCrop();
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (dragRef.current?.type === 'panning') {
      canvas.style.cursor = 'grabbing';
      return;
    }

    if (isSpacePressed) {
      canvas.style.cursor = 'grab';
      return;
    }

    if (hoverHandle) {
      canvas.style.cursor = cursorForHandle(hoverHandle);
      return;
    }

    if (hoverInside && tool === 'crop') {
      canvas.style.cursor = 'move';
      return;
    }

    if (tool === 'crop') {
      canvas.style.cursor = 'crosshair';
    } else {
      canvas.style.cursor = 'default';
    }
  }, [hoverHandle, hoverInside, tool, isSpacePressed]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, size.width * dpr);
    canvas.height = Math.max(1, size.height * dpr);
    canvas.style.width = `${size.width}px`;
    canvas.style.height = `${size.height}px`;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size.width, size.height);

    const style = getComputedStyle(canvas);
    const bg = style.getPropertyValue('--canvas-bg').trim() || '#f4f4f4';
    const mask = style.getPropertyValue('--canvas-mask').trim() || 'rgba(0,0,0,0.45)';
    const stroke = style.getPropertyValue('--canvas-stroke').trim() || '#111';
    const guide = style.getPropertyValue('--canvas-guide').trim() || 'rgba(255,255,255,0.35)';
    const handleFill = style.getPropertyValue('--canvas-handle').trim() || '#fff';
    const hudBg = style.getPropertyValue('--canvas-hud').trim() || 'rgba(0,0,0,0.6)';

    if (allowOutside && !patternRef.current) {
      const patternCanvas = document.createElement('canvas');
      patternCanvas.width = 24;
      patternCanvas.height = 24;
      const pctx = patternCanvas.getContext('2d');
      if (pctx) {
        pctx.fillStyle = style.getPropertyValue('--checker-a').trim() || '#e1e1e1';
        pctx.fillRect(0, 0, 24, 24);
        pctx.fillStyle = style.getPropertyValue('--checker-b').trim() || '#cfcfcf';
        pctx.fillRect(0, 0, 12, 12);
        pctx.fillRect(12, 12, 12, 12);
        patternRef.current = ctx.createPattern(patternCanvas, 'repeat');
      }
    }

    if (allowOutside && patternRef.current) {
      ctx.fillStyle = patternRef.current;
      ctx.fillRect(0, 0, size.width, size.height);
    } else {
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, size.width, size.height);
    }

    if (!image) {
      ctx.fillStyle = style.getPropertyValue('--canvas-empty').trim() || '#8a8a8a';
      ctx.font = '14px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText('Drop an image or use Open…', size.width / 2, size.height / 2);
      return;
    }

    const origin = imageOrigin();

    ctx.save();
    ctx.translate(origin.x, origin.y);
    ctx.scale(view.zoom, view.zoom);

    if (appliedCropRect) {
      ctx.beginPath();
      ctx.rect(
        appliedCropRect.x,
        appliedCropRect.y,
        appliedCropRect.w,
        appliedCropRect.h
      );
      ctx.clip();
    }

    switch (rotation) {
      case 0:
        ctx.drawImage(image.bitmap, 0, 0);
        break;
      case 90:
        ctx.translate(orientedSize.w, 0);
        ctx.rotate(Math.PI / 2);
        ctx.drawImage(image.bitmap, 0, 0);
        break;
      case 180:
        ctx.translate(orientedSize.w, orientedSize.h);
        ctx.rotate(Math.PI);
        ctx.drawImage(image.bitmap, 0, 0);
        break;
      case 270:
        ctx.translate(0, orientedSize.h);
        ctx.rotate(-Math.PI / 2);
        ctx.drawImage(image.bitmap, 0, 0);
        break;
      default:
        ctx.drawImage(image.bitmap, 0, 0);
    }

    ctx.restore();

    if (cropRect) {
      const rectScreen = {
        x: origin.x + cropRect.x * view.zoom,
        y: origin.y + cropRect.y * view.zoom,
        w: cropRect.w * view.zoom,
        h: cropRect.h * view.zoom,
      };

      const imgRectScreen = {
        x: origin.x + activeBounds.x * view.zoom,
        y: origin.y + activeBounds.y * view.zoom,
        w: activeBounds.w * view.zoom,
        h: activeBounds.h * view.zoom,
      };

      ctx.save();
      ctx.fillStyle = mask;
      ctx.beginPath();
      ctx.rect(imgRectScreen.x, imgRectScreen.y, imgRectScreen.w, imgRectScreen.h);
      ctx.rect(rectScreen.x, rectScreen.y, rectScreen.w, rectScreen.h);
      ctx.fill('evenodd');
      ctx.restore();

      ctx.save();
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 1;
      ctx.strokeRect(
        Math.round(rectScreen.x) + 0.5,
        Math.round(rectScreen.y) + 0.5,
        Math.round(rectScreen.w),
        Math.round(rectScreen.h)
      );
      ctx.restore();

      ctx.save();
      ctx.strokeStyle = guide;
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      for (const g of guides) {
        if (g.axis === 'x') {
          const gx = origin.x + g.value * view.zoom;
          ctx.beginPath();
          ctx.moveTo(gx, imgRectScreen.y);
          ctx.lineTo(gx, imgRectScreen.y + imgRectScreen.h);
          ctx.stroke();
        } else {
          const gy = origin.y + g.value * view.zoom;
          ctx.beginPath();
          ctx.moveTo(imgRectScreen.x, gy);
          ctx.lineTo(imgRectScreen.x + imgRectScreen.w, gy);
          ctx.stroke();
        }
      }
      ctx.restore();

      ctx.save();
      ctx.strokeStyle = guide;
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 4]);
      const thirdsX = [rectScreen.x + rectScreen.w / 3, rectScreen.x + (2 * rectScreen.w) / 3];
      const thirdsY = [rectScreen.y + rectScreen.h / 3, rectScreen.y + (2 * rectScreen.h) / 3];
      for (const gx of thirdsX) {
        ctx.beginPath();
        ctx.moveTo(gx, rectScreen.y);
        ctx.lineTo(gx, rectScreen.y + rectScreen.h);
        ctx.stroke();
      }
      for (const gy of thirdsY) {
        ctx.beginPath();
        ctx.moveTo(rectScreen.x, gy);
        ctx.lineTo(rectScreen.x + rectScreen.w, gy);
        ctx.stroke();
      }
      ctx.restore();

      ctx.save();
      ctx.fillStyle = handleFill;
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 1;
      for (const handle of handlePositions(rectScreen)) {
        ctx.beginPath();
        ctx.rect(
          handle.x - HANDLE_SIZE / 2,
          handle.y - HANDLE_SIZE / 2,
          HANDLE_SIZE,
          HANDLE_SIZE
        );
        ctx.fill();
        ctx.stroke();
      }
      ctx.restore();

      ctx.save();
      ctx.fillStyle = hudBg;
      ctx.font = '12px system-ui';
      ctx.textAlign = 'left';
      const hudText = `${Math.round(cropRect.w)}×${Math.round(cropRect.h)}  (${Math.round(
        cropRect.x
      )}, ${Math.round(cropRect.y)})`;
      const metrics = ctx.measureText(hudText);
      const hudX = rectScreen.x + 8;
      const hudY = rectScreen.y - 10;
      const padding = 6;
      ctx.fillRect(
        hudX - padding,
        hudY - 16,
        metrics.width + padding * 2,
        20
      );
      ctx.fillStyle = '#fff';
      ctx.fillText(hudText, hudX, hudY);
      ctx.restore();
    }
  }, [
    size,
    image,
    view.zoom,
    view.pan,
    orientedSize,
    activeBounds,
    cropRect,
    allowOutside,
    guides,
    rotation,
    imageOrigin,
    appliedCropRect,
  ]);

  return (
    <div className="canvas-wrap" ref={wrapperRef}>
      <canvas
        ref={canvasRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
        onWheel={onWheel}
        onDoubleClick={onDoubleClick}
      />
      {(isLoading || isDragging || errorMessage) && (
        <div
          className={`canvas-overlay ${
            errorMessage ? 'error' : isDragging ? 'drag' : 'loading'
          }`}
        >
          {errorMessage ?? (isDragging ? 'Drop image to open' : 'Loading…')}
        </div>
      )}
    </div>
  );
};
