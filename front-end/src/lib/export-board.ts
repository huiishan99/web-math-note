import type { CalculationItem } from "@/types/calculator";
import {
  getResultText,
  isMathLikeResult,
  shouldUseResultCard,
} from "@/lib/result-format";

const EXPORT_BACKGROUND = "#08090b";

function drawBoardBackground(ctx: CanvasRenderingContext2D, width: number, height: number) {
  ctx.fillStyle = EXPORT_BACKGROUND;
  ctx.fillRect(0, 0, width, height);

  ctx.save();
  ctx.strokeStyle = "rgba(255,255,255,0.026)";
  ctx.lineWidth = 1;
  for (let x = 95.5; x < width; x += 96) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  for (let y = 95.5; y < height; y += 96) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  ctx.fillStyle = "rgba(255,255,255,0.09)";
  for (let y = 1; y < height; y += 24) {
    for (let x = 1; x < width; x += 24) {
      ctx.fillRect(x, y, 1, 1);
    }
  }
  ctx.restore();
}

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  const safeRadius = Math.min(radius, width / 2, height / 2);

  ctx.beginPath();
  ctx.moveTo(x + safeRadius, y);
  ctx.lineTo(x + width - safeRadius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + safeRadius);
  ctx.lineTo(x + width, y + height - safeRadius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - safeRadius, y + height);
  ctx.lineTo(x + safeRadius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - safeRadius);
  ctx.lineTo(x, y + safeRadius);
  ctx.quadraticCurveTo(x, y, x + safeRadius, y);
  ctx.closePath();
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  const lines: string[] = [];

  text.split("\n").forEach((paragraph) => {
    const words = paragraph.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      lines.push("");
      return;
    }

    let line = "";
    words.forEach((word) => {
      const candidate = line ? `${line} ${word}` : word;
      if (ctx.measureText(candidate).width <= maxWidth) {
        line = candidate;
        return;
      }

      if (line) {
        lines.push(line);
      }
      line = word;
    });

    if (line) {
      lines.push(line);
    }
  });

  return lines;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function drawResult(ctx: CanvasRenderingContext2D, result: CalculationItem, canvasWidth: number, canvasHeight: number) {
  const resultText = getResultText(result);
  const mathLike = isMathLikeResult(resultText);
  const card = shouldUseResultCard(result, resultText);
  const text = getResultText(result, card && !mathLike);
  const x = clamp(result.position.x, 12, canvasWidth - 32);
  const y = clamp(result.position.y, 16, canvasHeight - 24);

  ctx.save();
  ctx.textBaseline = "top";

  if (!card) {
    ctx.fillStyle = "#ffffff";
    ctx.shadowColor = "rgba(0,0,0,0.95)";
    ctx.shadowBlur = 10;
    ctx.font = "500 34px Georgia, 'Times New Roman', serif";
    ctx.fillText(resultText, x, y);
    ctx.restore();
    return;
  }

  const cardWidth = Math.min(360, canvasWidth - x - 16);
  const textWidth = Math.max(160, cardWidth - 28);

  ctx.font = "18px Georgia, 'Times New Roman', serif";
  const lines = wrapText(ctx, text, textWidth);
  result.steps.forEach((step) => lines.push(step));

  const lineHeight = 24;
  const cardHeight = Math.max(48, 24 + lines.length * lineHeight);

  ctx.fillStyle = "rgba(10,10,12,0.78)";
  roundedRect(ctx, x, y, cardWidth, cardHeight, 6);
  ctx.fill();

  ctx.strokeStyle = "rgba(255,255,255,0.12)";
  ctx.lineWidth = 1;
  roundedRect(ctx, x, y, cardWidth, cardHeight, 6);
  ctx.stroke();

  ctx.fillStyle = "#ffffff";
  lines.forEach((line, index) => {
    ctx.fillText(line, x + 14, y + 12 + index * lineHeight);
  });
  ctx.restore();
}

export function exportBoardAsPng(canvas: HTMLCanvasElement, results: CalculationItem[]) {
  const exportedCanvas = document.createElement("canvas");
  exportedCanvas.width = canvas.width;
  exportedCanvas.height = canvas.height;

  const ctx = exportedCanvas.getContext("2d");
  if (!ctx) {
    return canvas.toDataURL("image/png");
  }

  drawBoardBackground(ctx, exportedCanvas.width, exportedCanvas.height);
  ctx.drawImage(canvas, 0, 0);
  results.forEach((result) => drawResult(ctx, result, exportedCanvas.width, exportedCanvas.height));

  return exportedCanvas.toDataURL("image/png");
}

export function getExportFilename(pageTitle: string) {
  const safeTitle = pageTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  return `${safeTitle || "math-note"}.png`;
}
