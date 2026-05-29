import { useCallback, useEffect, useRef, useState } from "react";
import type { PointerEvent } from "react";

import { exportCanvasAsPng, exportCanvasRegionAsPng, getInkBounds, getInkBoundsInRect } from "@/lib/canvas";
import type { CanvasRect, InkBounds } from "@/lib/canvas";

interface CanvasPayload {
  image: string;
  bounds: InkBounds;
}

interface CanvasRegionPayload extends CanvasPayload {
  rect: CanvasRect;
}

export interface CanvasSnapshot {
  dataUrl: string;
  width: number;
  height: number;
}

export type DrawingTool = "pen" | "eraser" | "select";

interface Point {
  x: number;
  y: number;
  pressure: number;
}

const MAX_HISTORY_LENGTH = 30;
const DEFAULT_PRESSURE = 0.55;

function getMidpoint(a: Point, b: Point) {
  return {
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
  };
}

export function useDrawingCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawingRef = useRef(false);
  const historyRef = useRef<ImageData[]>([]);
  const pointsRef = useRef<Point[]>([]);
  const [color, setColor] = useState("#ffffff");
  const [tool, setTool] = useState<DrawingTool>("pen");
  const [strokeWidth, setStrokeWidth] = useState(4);
  const [canUndo, setCanUndo] = useState(false);
  const [hasInk, setHasInk] = useState(false);
  const [isCanvasReady, setIsCanvasReady] = useState(false);
  const [canvasVersion, setCanvasVersion] = useState(0);

  const configureContext = useCallback((canvas: HTMLCanvasElement) => {
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return;
    }

    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.miterLimit = 1;
  }, []);

  const configureStroke = useCallback((ctx: CanvasRenderingContext2D, pressure = DEFAULT_PRESSURE) => {
    const normalizedPressure = pressure > 0 ? pressure : DEFAULT_PRESSURE;
    const pressureWidth = strokeWidth * (0.82 + normalizedPressure * 0.32);

    ctx.globalCompositeOperation = tool === "eraser" ? "destination-out" : "source-over";
    ctx.strokeStyle = tool === "eraser" ? "rgba(0,0,0,1)" : color;
    ctx.fillStyle = tool === "eraser" ? "rgba(0,0,0,1)" : color;
    ctx.lineWidth = tool === "eraser" ? Math.max(24, strokeWidth * 5) : pressureWidth;
  }, [color, strokeWidth, tool]);

  const refreshInkPresence = useCallback(() => {
    const canvas = canvasRef.current;
    setHasInk(Boolean(canvas && getInkBounds(canvas)));
  }, []);

  const markCanvasChanged = useCallback(() => {
    refreshInkPresence();
    setCanvasVersion((version) => version + 1);
  }, [refreshInkPresence]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const resizeCanvas = () => {
      const previousCanvas = document.createElement("canvas");
      const hadContent = canvas.width > 0 && canvas.height > 0;

      if (hadContent) {
        previousCanvas.width = canvas.width;
        previousCanvas.height = canvas.height;
        previousCanvas.getContext("2d")?.drawImage(canvas, 0, 0);
      }

      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      configureContext(canvas);

      if (hadContent) {
        canvas.getContext("2d")?.drawImage(previousCanvas, 0, 0);
      }
      refreshInkPresence();
      setIsCanvasReady(true);
    };

    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    return () => window.removeEventListener("resize", resizeCanvas);
  }, [configureContext, refreshInkPresence]);

  const getPointerPosition = useCallback((event: PointerEvent<HTMLCanvasElement>): Point | null => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return null;
    }

    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * canvas.width,
      y: ((event.clientY - rect.top) / rect.height) * canvas.height,
      pressure: event.pressure || DEFAULT_PRESSURE,
    };
  }, []);

  const getCanvasRectFromScreenRect = useCallback((rect: CanvasRect): CanvasRect | null => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return null;
    }

    const canvasBounds = canvas.getBoundingClientRect();
    const x = ((rect.x - canvasBounds.left) / canvasBounds.width) * canvas.width;
    const y = ((rect.y - canvasBounds.top) / canvasBounds.height) * canvas.height;
    const width = (rect.width / canvasBounds.width) * canvas.width;
    const height = (rect.height / canvasBounds.height) * canvas.height;

    if (width <= 0 || height <= 0) {
      return null;
    }

    return { x, y, width, height };
  }, []);

  const getScreenRectFromCanvasRect = useCallback((rect: CanvasRect): CanvasRect | null => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return null;
    }

    const canvasBounds = canvas.getBoundingClientRect();
    return {
      x: canvasBounds.left + (rect.x / canvas.width) * canvasBounds.width,
      y: canvasBounds.top + (rect.y / canvas.height) * canvasBounds.height,
      width: (rect.width / canvas.width) * canvasBounds.width,
      height: (rect.height / canvas.height) * canvasBounds.height,
    };
  }, []);

  const saveSnapshot = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) {
      return;
    }

    historyRef.current.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
    if (historyRef.current.length > MAX_HISTORY_LENGTH) {
      historyRef.current.shift();
    }
    setCanUndo(historyRef.current.length > 0);
  }, []);

  const startDrawing = useCallback((event: PointerEvent<HTMLCanvasElement>) => {
    if (tool === "select" || !event.isPrimary) {
      return;
    }

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    const point = getPointerPosition(event);

    if (!canvas || !ctx || !point) {
      return;
    }

    saveSnapshot();
    canvas.setPointerCapture(event.pointerId);
    configureStroke(ctx, point.pressure);
    pointsRef.current = [point];
    ctx.beginPath();
    ctx.moveTo(point.x, point.y);
    isDrawingRef.current = true;
  }, [configureStroke, getPointerPosition, saveSnapshot, tool]);

  const draw = useCallback((event: PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current || !event.isPrimary) {
      return;
    }

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    const point = getPointerPosition(event);

    if (!ctx || !point) {
      return;
    }

    const points = pointsRef.current;
    points.push(point);
    configureStroke(ctx, point.pressure);

    if (points.length < 3) {
      ctx.lineTo(point.x, point.y);
      ctx.stroke();
      return;
    }

    const previousPoint = points[points.length - 3];
    const currentPoint = points[points.length - 2];
    const nextPoint = points[points.length - 1];
    const previousMidpoint = getMidpoint(previousPoint, currentPoint);
    const nextMidpoint = getMidpoint(currentPoint, nextPoint);

    ctx.beginPath();
    ctx.moveTo(previousMidpoint.x, previousMidpoint.y);
    ctx.quadraticCurveTo(currentPoint.x, currentPoint.y, nextMidpoint.x, nextMidpoint.y);
    ctx.stroke();
  }, [configureStroke, getPointerPosition]);

  const stopDrawing = useCallback((event: PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) {
      return;
    }

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (ctx) {
      if (pointsRef.current.length === 1) {
        const [point] = pointsRef.current;
        configureStroke(ctx, point.pressure);
        ctx.beginPath();
        ctx.arc(point.x, point.y, ctx.lineWidth / 2, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.closePath();
      ctx.globalCompositeOperation = "source-over";
    }
    if (canvas?.hasPointerCapture(event.pointerId)) {
      canvas.releasePointerCapture(event.pointerId);
    }
    pointsRef.current = [];
    isDrawingRef.current = false;
    markCanvasChanged();
  }, [configureStroke, markCanvasChanged]);

  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) {
      return;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.globalCompositeOperation = "source-over";
    markCanvasChanged();
  }, [markCanvasChanged]);

  const deleteCanvasRegion = useCallback((screenRect: CanvasRect) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    const canvasRect = getCanvasRectFromScreenRect(screenRect);
    if (!canvas || !ctx || !canvasRect) {
      return false;
    }

    const padding = Math.max(6, strokeWidth * 3);
    ctx.clearRect(
      canvasRect.x - padding,
      canvasRect.y - padding,
      canvasRect.width + padding * 2,
      canvasRect.height + padding * 2,
    );
    ctx.globalCompositeOperation = "source-over";
    markCanvasChanged();
    return true;
  }, [getCanvasRectFromScreenRect, markCanvasChanged, strokeWidth]);

  const moveCanvasRegion = useCallback((fromScreenRect: CanvasRect, toScreenRect: CanvasRect) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    const fromCanvasRect = getCanvasRectFromScreenRect(fromScreenRect);
    const toCanvasRect = getCanvasRectFromScreenRect(toScreenRect);
    if (!canvas || !ctx || !fromCanvasRect || !toCanvasRect) {
      return false;
    }

    const padding = Math.max(6, strokeWidth * 3);
    const sourceX = Math.max(0, Math.floor(fromCanvasRect.x - padding));
    const sourceY = Math.max(0, Math.floor(fromCanvasRect.y - padding));
    const sourceMaxX = Math.min(canvas.width, Math.ceil(fromCanvasRect.x + fromCanvasRect.width + padding));
    const sourceMaxY = Math.min(canvas.height, Math.ceil(fromCanvasRect.y + fromCanvasRect.height + padding));
    const sourceWidth = sourceMaxX - sourceX;
    const sourceHeight = sourceMaxY - sourceY;

    if (sourceWidth <= 0 || sourceHeight <= 0) {
      return false;
    }

    const imageData = ctx.getImageData(sourceX, sourceY, sourceWidth, sourceHeight);
    const targetX = Math.round(toCanvasRect.x - (fromCanvasRect.x - sourceX));
    const targetY = Math.round(toCanvasRect.y - (fromCanvasRect.y - sourceY));

    ctx.clearRect(sourceX, sourceY, sourceWidth, sourceHeight);
    ctx.putImageData(imageData, targetX, targetY);
    ctx.globalCompositeOperation = "source-over";
    markCanvasChanged();
    return true;
  }, [getCanvasRectFromScreenRect, markCanvasChanged, strokeWidth]);

  const resetCanvas = useCallback(() => {
    clearCanvas();
    historyRef.current = [];
    setCanUndo(false);
  }, [clearCanvas]);

  const undo = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    const previous = historyRef.current.pop();

    if (!canvas || !ctx || !previous) {
      return;
    }

    ctx.putImageData(previous, 0, 0);
    ctx.globalCompositeOperation = "source-over";
    setCanUndo(historyRef.current.length > 0);
    markCanvasChanged();
  }, [markCanvasChanged]);

  const getCanvasSnapshot = useCallback((): CanvasSnapshot | null => {
    const canvas = canvasRef.current;
    if (!canvas || !getInkBounds(canvas)) {
      return null;
    }

    return {
      dataUrl: canvas.toDataURL("image/png"),
      width: canvas.width,
      height: canvas.height,
    };
  }, []);

  const getCanvasThumbnail = useCallback((maxWidth = 96): string | null => {
    const canvas = canvasRef.current;
    if (!canvas || !getInkBounds(canvas)) {
      return null;
    }

    const scale = maxWidth / canvas.width;
    const thumbnailCanvas = document.createElement("canvas");
    thumbnailCanvas.width = maxWidth;
    thumbnailCanvas.height = Math.max(1, Math.round(canvas.height * scale));

    const ctx = thumbnailCanvas.getContext("2d");
    if (!ctx) {
      return null;
    }

    ctx.fillStyle = "#08090b";
    ctx.fillRect(0, 0, thumbnailCanvas.width, thumbnailCanvas.height);
    ctx.drawImage(canvas, 0, 0, thumbnailCanvas.width, thumbnailCanvas.height);

    return thumbnailCanvas.toDataURL("image/png");
  }, []);

  const loadCanvasSnapshot = useCallback((snapshot: CanvasSnapshot | null) => new Promise<void>((resolve) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) {
      resolve();
      return;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.globalCompositeOperation = "source-over";
    historyRef.current = [];
    setCanUndo(false);

    if (!snapshot?.dataUrl) {
      markCanvasChanged();
      resolve();
      return;
    }

    const image = new Image();
    image.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      markCanvasChanged();
      resolve();
    };
    image.onerror = () => {
      markCanvasChanged();
      resolve();
    };
    image.src = snapshot.dataUrl;
  }), [markCanvasChanged]);

  const getCanvasPayload = useCallback((): CanvasPayload | null => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return null;
    }

    const bounds = getInkBounds(canvas);
    if (!bounds) {
      return null;
    }

    return {
      image: exportCanvasAsPng(canvas),
      bounds,
    };
  }, []);

  const getCanvasSelectionRect = useCallback((screenRect: CanvasRect): CanvasRect | null => {
    const canvas = canvasRef.current;
    const canvasRect = getCanvasRectFromScreenRect(screenRect);
    if (!canvas || !canvasRect) {
      return null;
    }

    const bounds = getInkBoundsInRect(canvas, canvasRect);
    if (!bounds) {
      return null;
    }

    const padding = Math.max(12, strokeWidth * 4);
    const paddedCanvasRect = {
      x: Math.max(0, bounds.minX - padding),
      y: Math.max(0, bounds.minY - padding),
      width: Math.min(canvas.width, bounds.maxX + padding) - Math.max(0, bounds.minX - padding),
      height: Math.min(canvas.height, bounds.maxY + padding) - Math.max(0, bounds.minY - padding),
    };

    return getScreenRectFromCanvasRect(paddedCanvasRect);
  }, [getCanvasRectFromScreenRect, getScreenRectFromCanvasRect, strokeWidth]);

  const getCanvasRegionPayload = useCallback((screenRect: CanvasRect): CanvasRegionPayload | null => {
    const canvas = canvasRef.current;
    const canvasRect = getCanvasRectFromScreenRect(screenRect);
    if (!canvas || !canvasRect) {
      return null;
    }

    const bounds = getInkBoundsInRect(canvas, canvasRect);
    if (!bounds) {
      return null;
    }

    const padding = Math.max(12, strokeWidth * 4);
    const regionRect = {
      x: Math.max(0, bounds.minX - padding),
      y: Math.max(0, bounds.minY - padding),
      width: Math.min(canvas.width, bounds.maxX + padding) - Math.max(0, bounds.minX - padding),
      height: Math.min(canvas.height, bounds.maxY + padding) - Math.max(0, bounds.minY - padding),
    };
    const image = exportCanvasRegionAsPng(canvas, regionRect);

    if (!image) {
      return null;
    }

    return {
      image,
      bounds,
      rect: regionRect,
    };
  }, [getCanvasRectFromScreenRect, strokeWidth]);

  return {
    canvasRef,
    color,
    setColor,
    tool,
    setTool,
    strokeWidth,
    setStrokeWidth,
    canUndo,
    hasInk,
    isCanvasReady,
    canvasVersion,
    startDrawing,
    draw,
    stopDrawing,
    clearCanvas,
    resetCanvas,
    undo,
    deleteCanvasRegion,
    moveCanvasRegion,
    getCanvasPayload,
    getCanvasRegionPayload,
    getCanvasSelectionRect,
    getCanvasSnapshot,
    getCanvasThumbnail,
    loadCanvasSnapshot,
  };
}
