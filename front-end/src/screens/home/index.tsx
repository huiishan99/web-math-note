import { useState } from "react";
import { Sparkles } from "lucide-react";

import { CanvasBoard } from "@/components/math-board/CanvasBoard";
import { ResultLayer } from "@/components/math-board/ResultLayer";
import { Toolbar } from "@/components/math-board/Toolbar";
import { VariablePanel } from "@/components/math-board/VariablePanel";
import { useCalculator } from "@/hooks/useCalculator";
import { useDrawingCanvas } from "@/hooks/useDrawingCanvas";
import type { InkBounds } from "@/lib/canvas";

function getAnswerPosition(bounds: InkBounds, hasVariables: boolean) {
  const isNarrowViewport = window.innerWidth < 640;
  const estimatedAnswerWidth = isNarrowViewport ? Math.min(300, window.innerWidth - 32) : 180;
  const rightX = bounds.maxX + 28;
  const expressionCenterY = bounds.minY + (bounds.maxY - bounds.minY) / 2;

  if (!isNarrowViewport && rightX + estimatedAnswerWidth < window.innerWidth) {
    return {
      x: rightX,
      y: Math.max(expressionCenterY - 24, 84),
    };
  }

  const bottomSafeArea = isNarrowViewport ? (hasVariables ? 260 : 180) : 96;

  return {
    x: Math.max(Math.min(bounds.minX, window.innerWidth - estimatedAnswerWidth), 16),
    y: Math.min(bounds.maxY + 18, window.innerHeight - bottomSafeArea),
  };
}

export default function Home() {
  const drawing = useDrawingCanvas();
  const calculator = useCalculator();
  const [notice, setNotice] = useState<string | null>(null);

  const handleRun = async () => {
    const payload = drawing.getCanvasPayload();
    if (!payload) {
      setNotice("Write something on the board first.");
      calculator.setError(null);
      return;
    }

    setNotice(null);
    await calculator.calculate(payload.image, getAnswerPosition(payload.bounds, calculator.hasVariables));
  };

  const handleReset = () => {
    drawing.resetCanvas();
    calculator.clearAll();
    setNotice(null);
  };

  const statusMessage = notice || calculator.error;
  const statusTone = calculator.error ? "border-red-300/25 bg-red-950/75 text-red-50" : "border-white/10 bg-neutral-950/72 text-white";
  const statusPosition = calculator.hasVariables
    ? "bottom-[calc(env(safe-area-inset-bottom)+13rem)] sm:bottom-4"
    : "bottom-[calc(env(safe-area-inset-bottom)+7.5rem)] sm:bottom-4";
  const isEmpty = !drawing.hasInk && calculator.results.length === 0;

  return (
    <main className="relative h-[100dvh] min-h-[100dvh] overflow-hidden bg-[#090a0c] text-white">
      <CanvasBoard
        canvasRef={drawing.canvasRef}
        tool={drawing.tool}
        onPointerDown={drawing.startDrawing}
        onPointerMove={drawing.draw}
        onPointerUp={drawing.stopDrawing}
      />
      {isEmpty && (
        <div className="pointer-events-none absolute left-1/2 top-[42%] z-10 -translate-x-1/2 -translate-y-1/2 select-none text-center">
          <div className="ghost-sample text-[2.7rem] text-white/[0.08] sm:text-[3.5rem]">
            1 + 1 = ?
          </div>
        </div>
      )}
      <ResultLayer
        results={calculator.results}
        onMove={calculator.moveResult}
        onCopy={setNotice}
      />
      <Toolbar
        color={drawing.color}
        tool={drawing.tool}
        strokeWidth={drawing.strokeWidth}
        canUndo={drawing.canUndo}
        isLoading={calculator.isLoading}
        onColorChange={drawing.setColor}
        onToolChange={drawing.setTool}
        onStrokeWidthChange={drawing.setStrokeWidth}
        onRun={handleRun}
        onReset={handleReset}
        onUndo={drawing.undo}
      />
      {calculator.isLoading && !statusMessage && (
        <div
          className={`fixed left-1/2 z-40 flex h-9 w-9 -translate-x-1/2 items-center justify-center rounded-md border border-white/10 bg-neutral-950/72 text-white shadow-xl shadow-black/30 backdrop-blur-xl ${statusPosition}`}
          aria-live="polite"
          aria-label="Solving"
        >
          <Sparkles className="h-4 w-4 animate-pulse" />
        </div>
      )}
      {calculator.hasVariables && (
        <VariablePanel variables={calculator.variables} onRemove={calculator.removeVariable} />
      )}
      {statusMessage && (
        <div className={`fixed left-1/2 z-40 max-w-[calc(100vw-2rem)] -translate-x-1/2 rounded-md border px-3 py-2 text-sm shadow-xl shadow-black/30 backdrop-blur-xl ${statusPosition} ${statusTone}`}>
          {statusMessage}
        </div>
      )}
    </main>
  );
}
