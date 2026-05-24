import { useState } from "react";

import { CanvasBoard } from "@/components/math-board/CanvasBoard";
import { ResultLayer } from "@/components/math-board/ResultLayer";
import { Toolbar } from "@/components/math-board/Toolbar";
import { VariablePanel } from "@/components/math-board/VariablePanel";
import { useCalculator } from "@/hooks/useCalculator";
import { useDrawingCanvas } from "@/hooks/useDrawingCanvas";

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
    const solvedItems = await calculator.calculate(payload.image, payload.bounds.center);
    if (solvedItems.length > 0) {
      drawing.clearCanvas();
    }
  };

  const handleReset = () => {
    drawing.resetCanvas();
    calculator.clearAll();
    setNotice(null);
  };

  const statusMessage = notice || calculator.error || (calculator.isLoading ? "Solving..." : null);
  const statusTone = calculator.error ? "border-red-400/30 bg-red-950/80 text-red-100" : "border-white/10 bg-zinc-950/85 text-white";

  return (
    <main className="relative min-h-screen overflow-hidden bg-black text-white">
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
        <div className={`fixed bottom-4 left-4 z-30 rounded-md border px-3 py-2 text-sm shadow-lg backdrop-blur ${statusTone}`}>
          {statusMessage}
        </div>
      )}
    </main>
  );
}
