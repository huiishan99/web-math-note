import { useCallback, useEffect, useRef, useState } from "react";
import type { PointerEvent } from "react";

import { exportCanvasAsPng, getInkBounds } from "@/lib/canvas";
import type { InkBounds } from "@/lib/canvas";

interface CanvasPayload {
  image: string;
  bounds: InkBounds;
}

const MAX_HISTORY_LENGTH = 30;

export function useDrawingCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawingRef = useRef(false);
  const historyRef = useRef<ImageData[]>([]);
  const [color, setColor] = useState("#ffffff");
  const [canUndo, setCanUndo] = useState(false);

  const configureContext = useCallback((canvas: HTMLCanvasElement) => {
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return;
    }

    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = 4;
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      configureContext(canvas);
    };

    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    return () => window.removeEventListener("resize", resizeCanvas);
  }, [configureContext]);

  const getPointerPosition = useCallback((event: PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return null;
    }

    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * canvas.width,
      y: ((event.clientY - rect.top) / rect.height) * canvas.height,
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
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    const point = getPointerPosition(event);

    if (!canvas || !ctx || !point) {
      return;
    }

    saveSnapshot();
    canvas.setPointerCapture(event.pointerId);
    ctx.beginPath();
    ctx.moveTo(point.x, point.y);
    isDrawingRef.current = true;
  }, [getPointerPosition, saveSnapshot]);

  const draw = useCallback((event: PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) {
      return;
    }

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    const point = getPointerPosition(event);

    if (!ctx || !point) {
      return;
    }

    ctx.strokeStyle = color;
    ctx.lineTo(point.x, point.y);
    ctx.stroke();
  }, [color, getPointerPosition]);

  const stopDrawing = useCallback((event: PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) {
      return;
    }

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (ctx) {
      ctx.closePath();
    }
    if (canvas?.hasPointerCapture(event.pointerId)) {
      canvas.releasePointerCapture(event.pointerId);
    }
    isDrawingRef.current = false;
  }, []);

  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) {
      return;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }, []);

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
    setCanUndo(historyRef.current.length > 0);
  }, []);

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

  return {
    canvasRef,
    color,
    setColor,
    canUndo,
    startDrawing,
    draw,
    stopDrawing,
    clearCanvas,
    resetCanvas,
    undo,
    getCanvasPayload,
  };
}
