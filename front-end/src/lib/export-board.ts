import type { CalculationItem } from "@/types/calculator";
import {
  getResultText,
  isMathLikeResult,
  shouldUseResultCard,
} from "@/lib/result-format";

const EXPORT_BACKGROUND = "#08090b";

interface BoardSnapshot {
  dataUrl: string;
  width: number;
  height: number;
}

export interface PdfExportPage {
  title: string;
  ink: BoardSnapshot | null;
  results: CalculationItem[];
}

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

function loadDataUrlImage(dataUrl: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = dataUrl;
  });
}

export async function exportSnapshotAsImage(
  snapshot: BoardSnapshot | null,
  results: CalculationItem[],
  mimeType = "image/png",
  quality = 0.92,
) {
  const exportedCanvas = document.createElement("canvas");
  exportedCanvas.width = snapshot?.width || window.innerWidth;
  exportedCanvas.height = snapshot?.height || window.innerHeight;

  const ctx = exportedCanvas.getContext("2d");
  if (!ctx) {
    return exportedCanvas.toDataURL(mimeType, quality);
  }

  drawBoardBackground(ctx, exportedCanvas.width, exportedCanvas.height);

  if (snapshot?.dataUrl) {
    try {
      const image = await loadDataUrlImage(snapshot.dataUrl);
      ctx.drawImage(image, 0, 0, exportedCanvas.width, exportedCanvas.height);
    } catch {
      // Keep the exported page background if the saved page image is unreadable.
    }
  }

  results.forEach((result) => drawResult(ctx, result, exportedCanvas.width, exportedCanvas.height));
  return exportedCanvas.toDataURL(mimeType, quality);
}

function dataUrlToBytes(dataUrl: string) {
  const base64 = dataUrl.split(",", 2)[1] ?? "";
  const binary = window.atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

function encodePdfText(text: string) {
  return new TextEncoder().encode(text);
}

function concatPdfParts(parts: Uint8Array[]) {
  const totalLength = parts.reduce((sum, part) => sum + part.length, 0);
  const output = new Uint8Array(totalLength);
  let offset = 0;

  parts.forEach((part) => {
    output.set(part, offset);
    offset += part.length;
  });

  return output;
}

export async function exportNotebookAsPdf(pages: PdfExportPage[]) {
  const imagePages = await Promise.all(pages.map(async (page) => {
    const dataUrl = await exportSnapshotAsImage(page.ink, page.results, "image/jpeg", 0.92);
    return {
      title: page.title,
      dataUrl,
      width: page.ink?.width || window.innerWidth,
      height: page.ink?.height || window.innerHeight,
    };
  }));

  const parts: Uint8Array[] = [];
  const offsets: number[] = [0];
  let byteOffset = 0;
  const add = (part: string | Uint8Array) => {
    const bytes = typeof part === "string" ? encodePdfText(part) : part;
    parts.push(bytes);
    byteOffset += bytes.length;
  };
  const addObject = (id: number, body: string) => {
    offsets[id] = byteOffset;
    add(`${id} 0 obj\n${body}\nendobj\n`);
  };

  add("%PDF-1.4\n");

  const pageObjectIds = imagePages.map((_, index) => 3 + index * 3);
  addObject(1, "<< /Type /Catalog /Pages 2 0 R >>");
  addObject(2, `<< /Type /Pages /Kids [${pageObjectIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageObjectIds.length} >>`);

  imagePages.forEach((page, index) => {
    const pageId = 3 + index * 3;
    const contentId = pageId + 1;
    const imageId = pageId + 2;
    const imageName = `Im${index + 1}`;
    const pdfWidth = 612;
    const pdfHeight = Math.max(240, Math.round(pdfWidth * (page.height / page.width)));
    const content = `q ${pdfWidth} 0 0 ${pdfHeight} 0 0 cm /${imageName} Do Q`;
    const imageBytes = dataUrlToBytes(page.dataUrl);

    addObject(
      pageId,
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pdfWidth} ${pdfHeight}] /Resources << /ProcSet [/PDF /ImageC] /XObject << /${imageName} ${imageId} 0 R >> >> /Contents ${contentId} 0 R >>`,
    );
    addObject(contentId, `<< /Length ${content.length} >>\nstream\n${content}\nendstream`);

    offsets[imageId] = byteOffset;
    add(`${imageId} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${page.width} /Height ${page.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${imageBytes.length} >>\nstream\n`);
    add(imageBytes);
    add("\nendstream\nendobj\n");
  });

  const xrefOffset = byteOffset;
  const objectCount = 2 + imagePages.length * 3;
  add(`xref\n0 ${objectCount + 1}\n`);
  add("0000000000 65535 f \n");
  for (let id = 1; id <= objectCount; id += 1) {
    add(`${String(offsets[id]).padStart(10, "0")} 00000 n \n`);
  }
  add(`trailer\n<< /Size ${objectCount + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`);

  return new Blob([concatPdfParts(parts)], { type: "application/pdf" });
}

export function getExportFilename(pageTitle: string) {
  const safeTitle = pageTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  return `${safeTitle || "math-note"}.png`;
}
