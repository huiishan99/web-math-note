import { useState } from "react";

import { CanvasBoard } from "@/components/math-board/CanvasBoard";
import { ResultLayer } from "@/components/math-board/ResultLayer";
import { Toolbar } from "@/components/math-board/Toolbar";
import { VariablePanel } from "@/components/math-board/VariablePanel";
import { useCalculator } from "@/hooks/useCalculator";
import { useDrawingCanvas } from "@/hooks/useDrawingCanvas";
import type { InkBounds } from "@/lib/canvas";

function getAnswerPosition(bounds: InkBounds) {
  const estimatedAnswerWidth = 180;
  const rightX = bounds.maxX + 28;
  const expressionCenterY = bounds.minY + (bounds.maxY - bounds.minY) / 2;

  if (rightX + estimatedAnswerWidth < window.innerWidth) {
    return {
      x: rightX,
      y: Math.max(expressionCenterY - 24, 84),
    };
  }

  return {
    x: Math.max(Math.min(bounds.minX, window.innerWidth - estimatedAnswerWidth), 16),
    y: Math.min(bounds.maxY + 18, window.innerHeight - 96),
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
    await calculator.calculate(payload.image, getAnswerPosition(payload.bounds));
  };

  const handleReset = () => {
    drawing.resetCanvas();
    calculator.clearAll();
    setNotice(null);
  };

  const statusMessage = notice || calculator.error || (calculator.isLoading ? "Solving..." : null);
  const statusTone = calculator.error ? "border-red-300/25 bg-red-950/75 text-red-50" : "border-white/10 bg-neutral-950/72 text-white";

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#090a0c] text-white">
      <CanvasBoard
        canvasRef={drawing.canvasRef}
        onPointerDown={drawing.startDrawing}
        onPointerMove={drawing.draw}
        onPointerUp={drawing.stopDrawing}
      />
      <ResultLayer results={calculator.results} onMove={calculator.moveResult} />
      <Toolbar
        color={drawing.color}
        canUndo={drawing.canUndo}
        isLoading={calculator.isLoading}
        onColorChange={drawing.setColor}
        onRun={handleRun}
        onReset={handleReset}
        onUndo={drawing.undo}
      />
      {calculator.hasVariables && (
        <VariablePanel variables={calculator.variables} onRemove={calculator.removeVariable} />
      )}
      {statusMessage && (
        <div className={`fixed bottom-4 left-1/2 z-40 max-w-[calc(100vw-2rem)] -translate-x-1/2 rounded-md border px-3 py-2 text-sm shadow-xl shadow-black/30 backdrop-blur-xl ${statusTone}`}>
          {statusMessage}
        </div>
      )}
    </main>
  );
}
