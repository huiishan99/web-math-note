import type { Position } from "@/types/calculator";

export interface InkBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  center: Position;
}

export interface CanvasRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function normalizeRect(canvas: HTMLCanvasElement, rect: CanvasRect): CanvasRect | null {
  const x = clamp(Math.floor(rect.x), 0, canvas.width);
  const y = clamp(Math.floor(rect.y), 0, canvas.height);
  const maxX = clamp(Math.ceil(rect.x + rect.width), 0, canvas.width);
  const maxY = clamp(Math.ceil(rect.y + rect.height), 0, canvas.height);

  if (maxX <= x || maxY <= y) {
    return null;
  }

  return {
    x,
    y,
    width: maxX - x,
    height: maxY - y,
  };
}

export function getInkBounds(canvas: HTMLCanvasElement): InkBounds | null {
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return null;
  }

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  let minX = canvas.width;
  let minY = canvas.height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < canvas.height; y += 1) {
    for (let x = 0; x < canvas.width; x += 1) {
      const index = (y * canvas.width + x) * 4;
      if (imageData.data[index + 3] > 0) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }

  if (maxX < 0 || maxY < 0) {
    return null;
  }

  return {
    minX,
    minY,
    maxX,
    maxY,
    center: {
      x: (minX + maxX) / 2,
      y: (minY + maxY) / 2,
    },
  };
}

export function getInkBoundsInRect(canvas: HTMLCanvasElement, rect: CanvasRect): InkBounds | null {
  const ctx = canvas.getContext("2d");
  const normalizedRect = normalizeRect(canvas, rect);
  if (!ctx || !normalizedRect) {
    return null;
  }

  const imageData = ctx.getImageData(
    normalizedRect.x,
    normalizedRect.y,
    normalizedRect.width,
    normalizedRect.height,
  );
  let minX = normalizedRect.x + normalizedRect.width;
  let minY = normalizedRect.y + normalizedRect.height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < normalizedRect.height; y += 1) {
    for (let x = 0; x < normalizedRect.width; x += 1) {
      const index = (y * normalizedRect.width + x) * 4;
      if (imageData.data[index + 3] > 0) {
        const canvasX = normalizedRect.x + x;
        const canvasY = normalizedRect.y + y;
        minX = Math.min(minX, canvasX);
        minY = Math.min(minY, canvasY);
        maxX = Math.max(maxX, canvasX);
        maxY = Math.max(maxY, canvasY);
      }
    }
  }

  if (maxX < 0 || maxY < 0) {
    return null;
  }

  return {
    minX,
    minY,
    maxX,
    maxY,
    center: {
      x: (minX + maxX) / 2,
      y: (minY + maxY) / 2,
    },
  };
}

export function exportCanvasAsPng(canvas: HTMLCanvasElement, background = "#000000") {
  const exportedCanvas = document.createElement("canvas");
  exportedCanvas.width = canvas.width;
  exportedCanvas.height = canvas.height;

  const ctx = exportedCanvas.getContext("2d");
  if (!ctx) {
    return canvas.toDataURL("image/png");
  }

  ctx.fillStyle = background;
  ctx.fillRect(0, 0, exportedCanvas.width, exportedCanvas.height);
  ctx.drawImage(canvas, 0, 0);

  return exportedCanvas.toDataURL("image/png");
}

export function exportCanvasRegionAsPng(
  canvas: HTMLCanvasElement,
  rect: CanvasRect,
  background = "#000000",
) {
  const normalizedRect = normalizeRect(canvas, rect);
  if (!normalizedRect) {
    return null;
  }

  const exportedCanvas = document.createElement("canvas");
  exportedCanvas.width = normalizedRect.width;
  exportedCanvas.height = normalizedRect.height;

  const ctx = exportedCanvas.getContext("2d");
  if (!ctx) {
    return null;
  }

  ctx.fillStyle = background;
  ctx.fillRect(0, 0, exportedCanvas.width, exportedCanvas.height);
  ctx.drawImage(
    canvas,
    normalizedRect.x,
    normalizedRect.y,
    normalizedRect.width,
    normalizedRect.height,
    0,
    0,
    normalizedRect.width,
    normalizedRect.height,
  );

  return exportedCanvas.toDataURL("image/png");
}
