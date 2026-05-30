import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import { Move, Sparkles, Trash2 } from "lucide-react";

import { CanvasBoard } from "@/components/math-board/CanvasBoard";
import { PageStrip } from "@/components/math-board/PageStrip";
import { ResultLayer } from "@/components/math-board/ResultLayer";
import { Toolbar } from "@/components/math-board/Toolbar";
import { VariablePanel } from "@/components/math-board/VariablePanel";
import { Button } from "@/components/ui/button";
import { useCalculator } from "@/hooks/useCalculator";
import { useDrawingCanvas } from "@/hooks/useDrawingCanvas";
import { useNotebook } from "@/hooks/useNotebook";
import { exportBoardAsPng, exportNotebookAsPdf, getExportFilename } from "@/lib/export-board";
import type { InkBounds } from "@/lib/canvas";
import type { CalculationItem, Position, SolverMode } from "@/types/calculator";

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function rectsIntersect(a: Rect, b: Rect) {
  return a.x < b.x + b.width
    && a.x + a.width > b.x
    && a.y < b.y + b.height
    && a.y + a.height > b.y;
}

function estimateResultRect(result: CalculationItem): Rect {
  const answer = String(result.result ?? "");
  const isCard = result.assign || result.steps.length > 0 || answer.length > 28;

  return {
    x: result.position.x - 12,
    y: result.position.y - 12,
    width: isCard ? 390 : Math.min(260, Math.max(96, answer.length * 20 + 56)),
    height: isCard ? Math.max(72, 64 + result.steps.length * 20) : 74,
  };
}

function makeAnswerRect(position: Position, width: number, height: number): Rect {
  return {
    x: position.x - 12,
    y: position.y - 12,
    width: width + 24,
    height: height + 24,
  };
}

function getAnswerPosition(bounds: InkBounds, hasVariables: boolean, existingResults: CalculationItem[]) {
  const isCompactViewport = window.innerWidth < 1280;
  const estimatedAnswerWidth = window.innerWidth < 640 ? Math.min(300, window.innerWidth - 32) : 180;
  const estimatedAnswerHeight = 70;
  const rightX = bounds.maxX + 28;
  const expressionCenterY = bounds.minY + (bounds.maxY - bounds.minY) / 2;
  const bottomSafeArea = isCompactViewport ? (hasVariables ? 320 : 220) : 96;
  const maxX = window.innerWidth - estimatedAnswerWidth - 16;
  const maxY = window.innerHeight - bottomSafeArea;
  const blockers = existingResults.map(estimateResultRect);

  const candidates: Position[] = [
    { x: rightX, y: expressionCenterY - 24 },
    { x: bounds.minX, y: bounds.maxY + 18 },
    { x: bounds.minX, y: bounds.minY - estimatedAnswerHeight - 18 },
    { x: bounds.minX - estimatedAnswerWidth - 28, y: expressionCenterY - 24 },
  ].map((candidate) => ({
    x: clamp(candidate.x, 16, Math.max(16, maxX)),
    y: clamp(candidate.y, 84, Math.max(84, maxY)),
  }));

  const availableCandidate = candidates.find((candidate) => (
    blockers.every((blocker) => !rectsIntersect(makeAnswerRect(candidate, estimatedAnswerWidth, estimatedAnswerHeight), blocker))
  ));

  if (availableCandidate) {
    return availableCandidate;
  }

  const fallback = candidates[1];
  for (let offset = 0; offset < window.innerHeight; offset += 82) {
    const below = {
      x: fallback.x,
      y: clamp(fallback.y + offset, 84, Math.max(84, maxY)),
    };
    if (blockers.every((blocker) => !rectsIntersect(makeAnswerRect(below, estimatedAnswerWidth, estimatedAnswerHeight), blocker))) {
      return below;
    }

    const above = {
      x: fallback.x,
      y: clamp(fallback.y - offset, 84, Math.max(84, maxY)),
    };
    if (blockers.every((blocker) => !rectsIntersect(makeAnswerRect(above, estimatedAnswerWidth, estimatedAnswerHeight), blocker))) {
      return above;
    }
  }

  return fallback;
}

export default function Home() {
  const drawing = useDrawingCanvas();
  const calculator = useCalculator();
  const [notice, setNotice] = useState<string | null>(null);
  const [selectedResultId, setSelectedResultId] = useState<string | null>(null);
  const [eraserCursor, setEraserCursor] = useState<Position | null>(null);
  const [selectionRect, setSelectionRect] = useState<Rect | null>(null);
  const [selectedInkRect, setSelectedInkRect] = useState<Rect | null>(null);
  const [solutionMode, setSolutionMode] = useState<SolverMode>("quick");
  const selectionStartRef = useRef<Position | null>(null);
  const inkMoveStartRef = useRef<Position | null>(null);
  const inkMoveBaseRectRef = useRef<Rect | null>(null);
  const {
    canvasVersion,
    getCanvasThumbnail,
    getCanvasSnapshot,
    isCanvasReady,
    loadCanvasSnapshot,
  } = drawing;
  const {
    replaceState,
    results,
    variables,
  } = calculator;
  const {
    activePage,
    addPage,
    canRedo,
    canUndo,
    createCurrentNotebookSnapshot,
    deletePage,
    importNotebookFromText,
    movePage,
    notebook,
    pushHistory,
    redo,
    renamePage,
    selectPage,
    undo,
  } = useNotebook({
    canvasVersion,
    getCanvasSnapshot,
    getCanvasThumbnail,
    isCanvasReady,
    loadCanvasSnapshot,
    replaceState,
    results,
    variables,
  });
  const fileName = useMemo(() => getExportFilename(activePage?.title ?? "math-note"), [activePage?.title]);

  useEffect(() => {
    if (selectedResultId && !results.some((result) => result.id === selectedResultId)) {
      setSelectedResultId(null);
    }
  }, [results, selectedResultId]);

  useEffect(() => {
    setSelectedResultId(null);
    setSelectedInkRect(null);
  }, [notebook.activePageId]);

  const handleRun = async () => {
    const payload = selectedInkRect
      ? drawing.getCanvasRegionPayload(selectedInkRect)
      : drawing.getCanvasPayload();
    if (!payload) {
      setNotice(selectedInkRect ? "Select some ink before solving." : "Write something on the board first.");
      calculator.setError(null);
      return;
    }

    pushHistory();
    setNotice(null);
    await calculator.calculate(
      payload.image,
      getAnswerPosition(payload.bounds, calculator.hasVariables, calculator.results),
      solutionMode,
    );
  };

  const handleReset = () => {
    pushHistory();
    drawing.resetCanvas();
    calculator.clearAll();
    setSelectedResultId(null);
    setSelectedInkRect(null);
    setNotice(null);
  };

  const handleAddPage = () => {
    addPage();
    setSelectedInkRect(null);
  };

  const handleRenamePage = (id: string, title: string) => {
    renamePage(id, title);
    setNotice("Page renamed.");
  };

  const handleDeletePage = (id: string) => {
    if (!deletePage(id)) {
      setNotice("Keep at least one page.");
      return;
    }

    setSelectedInkRect(null);
    setSelectedResultId(null);
    setNotice("Page deleted.");
  };

  const handleMovePage = (id: string, direction: -1 | 1) => {
    if (movePage(id, direction)) {
      setNotice("Page moved.");
    }
  };

  const handleSelectPage = (id: string) => {
    if (selectPage(id)) {
      setSelectedInkRect(null);
    }
  };

  const handleAcceptResult = (id: string) => {
    pushHistory();
    calculator.acceptResult(id);
    setNotice("Result accepted.");
  };

  const handleDismissResult = (id: string) => {
    pushHistory();
    calculator.deleteResult(id);
    setSelectedResultId(null);
    setNotice("Result dismissed.");
  };

  const handleDeleteResult = useCallback((id: string) => {
    pushHistory();
    calculator.deleteResult(id);
    setSelectedResultId(null);
    setNotice("Result removed.");
  }, [calculator, pushHistory]);

  const handleDeleteInkSelection = useCallback(() => {
    if (!selectedInkRect) {
      return;
    }

    pushHistory();
    if (drawing.deleteCanvasRegion(selectedInkRect)) {
      setSelectedInkRect(null);
      setNotice("Ink selection removed.");
    }
  }, [drawing, pushHistory, selectedInkRect]);

  const handleMoveResult = (id: string, position: Position) => {
    pushHistory();
    calculator.moveResult(id, position);
  };

  const handleRemoveVariable = (name: string) => {
    pushHistory();
    calculator.removeVariable(name);
  };

  const handleExport = useCallback(() => {
    const canvas = drawing.canvasRef.current;
    if (!canvas || (!drawing.hasInk && calculator.results.length === 0)) {
      setNotice("Nothing to export yet.");
      return;
    }

    const link = document.createElement("a");
    link.href = exportBoardAsPng(canvas, calculator.results);
    link.download = fileName;
    link.click();
    setNotice("Exported PNG.");
  }, [calculator.results, drawing.canvasRef, drawing.hasInk, fileName]);

  const handleExportNotebook = () => {
    const snapshot = createCurrentNotebookSnapshot();
    const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "web-math-note.mathnote.json";
    link.click();
    URL.revokeObjectURL(link.href);
    setNotice("Exported notebook.");
  };

  const handleExportNotebookPdf = async () => {
    const snapshot = createCurrentNotebookSnapshot();
    const pdf = await exportNotebookAsPdf(snapshot.pages.map((page) => ({
      title: page.title,
      ink: page.ink,
      results: page.results,
    })));
    const link = document.createElement("a");
    const objectUrl = URL.createObjectURL(pdf);
    link.href = objectUrl;
    link.download = "web-math-note.pdf";
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
    setNotice("Exported PDF.");
  };

  const handleImportNotebook = async (file: File) => {
    try {
      importNotebookFromText(await file.text());
      setNotice("Imported notebook.");
    } catch {
      setNotice("Could not import notebook.");
    }
  };

  const handleUndo = useCallback(() => {
    if (undo()) {
      setNotice("Undone.");
    }
  }, [undo]);

  const handleRedo = useCallback(() => {
    if (redo()) {
      setNotice("Redone.");
    }
  }, [redo]);

  const handleCanvasPointerDown = (event: PointerEvent<HTMLCanvasElement>) => {
    if (drawing.tool === "select") {
      setSelectedResultId(null);
      setSelectedInkRect(null);
      selectionStartRef.current = { x: event.clientX, y: event.clientY };
      setSelectionRect({
        x: event.clientX,
        y: event.clientY,
        width: 0,
        height: 0,
      });
      return;
    } else if (event.isPrimary) {
      pushHistory();
    }
    if (drawing.tool === "eraser") {
      setEraserCursor({ x: event.clientX, y: event.clientY });
    }
    drawing.startDrawing(event);
  };

  const handleCanvasPointerMove = (event: PointerEvent<HTMLCanvasElement>) => {
    if (drawing.tool === "select" && selectionStartRef.current) {
      const start = selectionStartRef.current;
      setSelectionRect({
        x: Math.min(start.x, event.clientX),
        y: Math.min(start.y, event.clientY),
        width: Math.abs(event.clientX - start.x),
        height: Math.abs(event.clientY - start.y),
      });
      return;
    }

    if (drawing.tool === "eraser") {
      setEraserCursor({ x: event.clientX, y: event.clientY });
    }
    drawing.draw(event);
  };

  const handleCanvasPointerUp = (event: PointerEvent<HTMLCanvasElement>) => {
    if (drawing.tool === "select") {
      const rect = selectionRect;
      selectionStartRef.current = null;
      setSelectionRect(null);

      if (rect && rect.width > 8 && rect.height > 8) {
        const selectedResult = [...calculator.results].reverse().find((result) => (
          rectsIntersect(rect, estimateResultRect(result))
        ));
        if (selectedResult) {
          setSelectedResultId(selectedResult.id);
          setSelectedInkRect(null);
          return;
        }

        const inkRect = drawing.getCanvasSelectionRect(rect);
        setSelectedInkRect(inkRect);
        setNotice(inkRect ? "Ink selected." : null);
      }
      return;
    }

    drawing.stopDrawing(event);
  };

  const handleCanvasPointerLeave = (event: PointerEvent<HTMLCanvasElement>) => {
    setEraserCursor(null);
    selectionStartRef.current = null;
    setSelectionRect(null);
    drawing.stopDrawing(event);
  };

  const handleInkSelectionPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (!selectedInkRect) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    inkMoveStartRef.current = { x: event.clientX, y: event.clientY };
    inkMoveBaseRectRef.current = selectedInkRect;
  };

  const handleInkSelectionPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!inkMoveStartRef.current || !inkMoveBaseRectRef.current) {
      return;
    }

    const deltaX = event.clientX - inkMoveStartRef.current.x;
    const deltaY = event.clientY - inkMoveStartRef.current.y;
    setSelectedInkRect({
      ...inkMoveBaseRectRef.current,
      x: inkMoveBaseRectRef.current.x + deltaX,
      y: inkMoveBaseRectRef.current.y + deltaY,
    });
  };

  const handleInkSelectionPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    const baseRect = inkMoveBaseRectRef.current;
    const nextRect = selectedInkRect;
    inkMoveStartRef.current = null;
    inkMoveBaseRectRef.current = null;

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    if (!baseRect || !nextRect) {
      return;
    }

    const moved = Math.abs(baseRect.x - nextRect.x) > 2 || Math.abs(baseRect.y - nextRect.y) > 2;
    if (!moved) {
      return;
    }

    pushHistory();
    drawing.moveCanvasRegion(baseRect, nextRect);
    setNotice("Ink selection moved.");
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const isCommand = event.metaKey || event.ctrlKey;
      const target = event.target as HTMLElement | null;
      const isTyping = target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.isContentEditable;
      if (isTyping) {
        return;
      }

      if (isCommand && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) {
          handleRedo();
          return;
        }
        handleUndo();
        return;
      }

      if (isCommand && event.key.toLowerCase() === "s") {
        event.preventDefault();
        handleExport();
        return;
      }

      if ((event.key === "Backspace" || event.key === "Delete") && selectedResultId) {
        event.preventDefault();
        handleDeleteResult(selectedResultId);
        return;
      }

      if ((event.key === "Backspace" || event.key === "Delete") && selectedInkRect) {
        event.preventDefault();
        handleDeleteInkSelection();
        return;
      }

      if (event.key === "Escape") {
        setSelectedResultId(null);
        setSelectedInkRect(null);
        return;
      }

      if (event.key.toLowerCase() === "p") {
        drawing.setTool("pen");
      } else if (event.key.toLowerCase() === "e") {
        drawing.setTool("eraser");
      } else if (event.key.toLowerCase() === "v") {
        drawing.setTool("select");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    drawing,
    handleDeleteInkSelection,
    handleDeleteResult,
    handleExport,
    handleRedo,
    handleUndo,
    selectedInkRect,
    selectedResultId,
  ]);

  const statusMessage = notice || calculator.error;
  const statusTone = calculator.error ? "border-red-300/25 bg-red-950/75 text-red-50" : "border-white/10 bg-neutral-950/72 text-white";
  const statusPosition = calculator.hasVariables
    ? "bottom-[calc(env(safe-area-inset-bottom)+16rem)] xl:bottom-4"
    : "bottom-[calc(env(safe-area-inset-bottom)+10rem)] xl:bottom-4";
  const isEmpty = !drawing.hasInk && calculator.results.length === 0;

  return (
    <main className="relative h-[100dvh] min-h-[100dvh] overflow-hidden bg-[#090a0c] text-white">
      <CanvasBoard
        canvasRef={drawing.canvasRef}
        tool={drawing.tool}
        onPointerDown={handleCanvasPointerDown}
        onPointerEnter={(event) => {
          if (drawing.tool === "eraser") {
            setEraserCursor({ x: event.clientX, y: event.clientY });
          }
        }}
        onPointerLeave={handleCanvasPointerLeave}
        onPointerMove={handleCanvasPointerMove}
        onPointerUp={handleCanvasPointerUp}
      />
      {selectionRect && (
        <div
          className="pointer-events-none fixed z-40 rounded-md border border-white/55 bg-white/[0.08]"
          style={{
            height: selectionRect.height,
            left: selectionRect.x,
            top: selectionRect.y,
            width: selectionRect.width,
          }}
        />
      )}
      {drawing.tool === "eraser" && eraserCursor && (
        <div
          className="pointer-events-none fixed z-40 rounded-full border border-white/50 bg-white/[0.08] shadow-[0_0_0_1px_rgba(0,0,0,0.65)]"
          style={{
            height: Math.max(24, drawing.strokeWidth * 5),
            left: eraserCursor.x,
            top: eraserCursor.y,
            transform: "translate(-50%, -50%)",
            width: Math.max(24, drawing.strokeWidth * 5),
          }}
        />
      )}
      {selectedInkRect && (
        <div
          className="pointer-events-auto fixed z-[25] cursor-move rounded-md border border-white/60 bg-white/[0.05] shadow-[0_0_0_1px_rgba(0,0,0,0.5)]"
          style={{
            height: selectedInkRect.height,
            left: selectedInkRect.x,
            top: selectedInkRect.y,
            width: selectedInkRect.width,
          }}
          onPointerDown={handleInkSelectionPointerDown}
          onPointerMove={handleInkSelectionPointerMove}
          onPointerUp={handleInkSelectionPointerUp}
          onPointerCancel={handleInkSelectionPointerUp}
          title="Drag selected ink"
        >
          <div className="absolute -right-1 top-full mt-1 flex items-center gap-1 rounded-md border border-white/10 bg-neutral-950/78 p-1 shadow-xl shadow-black/30 backdrop-blur-2xl">
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="!h-7 !w-7 text-white/70 hover:bg-white/10 hover:text-white"
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.stopPropagation();
                void handleRun();
              }}
              aria-label="Solve selected ink"
              title="Solve selected ink"
            >
              <Sparkles />
              <span className="sr-only">Solve selected ink</span>
            </Button>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="!h-7 !w-7 text-white/65 hover:bg-white/10 hover:text-white"
              onPointerDown={(event) => event.stopPropagation()}
              aria-label="Move selected ink"
              title="Drag selected ink"
            >
              <Move />
              <span className="sr-only">Move selected ink</span>
            </Button>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="!h-7 !w-7 text-red-100/80 hover:bg-red-400/15 hover:text-red-50"
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.stopPropagation();
                handleDeleteInkSelection();
              }}
              aria-label="Delete selected ink"
              title="Delete selected ink"
            >
              <Trash2 />
              <span className="sr-only">Delete selected ink</span>
            </Button>
          </div>
        </div>
      )}
      <PageStrip
        pages={notebook.pages}
        activePageId={notebook.activePageId}
        onAddPage={handleAddPage}
        onDeletePage={handleDeletePage}
        onExportNotebook={handleExportNotebook}
        onExportPdf={handleExportNotebookPdf}
        onImportNotebook={handleImportNotebook}
        onMovePage={handleMovePage}
        onRenamePage={handleRenamePage}
        onSelectPage={handleSelectPage}
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
        selectedResultId={selectedResultId}
        tool={drawing.tool}
        onAccept={handleAcceptResult}
        onDelete={handleDeleteResult}
        onDismiss={handleDismissResult}
        onMove={handleMoveResult}
        onSelect={setSelectedResultId}
        onCopy={setNotice}
      />
      <Toolbar
        color={drawing.color}
        tool={drawing.tool}
        solutionMode={solutionMode}
        strokeWidth={drawing.strokeWidth}
        canUndo={canUndo}
        canRedo={canRedo}
        canExport={drawing.hasInk || calculator.results.length > 0}
        isLoading={calculator.isLoading}
        onColorChange={drawing.setColor}
        onToolChange={drawing.setTool}
        onSolutionModeChange={setSolutionMode}
        onStrokeWidthChange={drawing.setStrokeWidth}
        onRun={handleRun}
        onExport={handleExport}
        onRedo={handleRedo}
        onReset={handleReset}
        onUndo={handleUndo}
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
        <VariablePanel variables={calculator.variables} onRemove={handleRemoveVariable} />
      )}
      {statusMessage && (
        <div className={`fixed left-1/2 z-40 max-w-[calc(100vw-2rem)] -translate-x-1/2 rounded-md border px-3 py-2 text-sm shadow-xl shadow-black/30 backdrop-blur-xl ${statusPosition} ${statusTone}`}>
          {statusMessage}
        </div>
      )}
    </main>
  );
}
