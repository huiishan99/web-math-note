import type { Position } from "@/types/calculator";

export interface InkBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  center: Position;
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
