import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import { Sparkles } from "lucide-react";

import { CanvasBoard } from "@/components/math-board/CanvasBoard";
import { PageStrip } from "@/components/math-board/PageStrip";
import { ResultLayer } from "@/components/math-board/ResultLayer";
import { Toolbar } from "@/components/math-board/Toolbar";
import { VariablePanel } from "@/components/math-board/VariablePanel";
import { useCalculator } from "@/hooks/useCalculator";
import { useDrawingCanvas, type CanvasSnapshot } from "@/hooks/useDrawingCanvas";
import { exportBoardAsPng, getExportFilename } from "@/lib/export-board";
import type { InkBounds } from "@/lib/canvas";
import type { CalculationItem, Position, VariableMap } from "@/types/calculator";

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface NotebookPage {
  id: string;
  title: string;
  ink: CanvasSnapshot | null;
  results: CalculationItem[];
  variables: VariableMap;
  updatedAt: number;
}

interface StoredNotebook {
  activePageId: string;
  pages: NotebookPage[];
}

const STORAGE_KEY = "web-math-note:notebook:v1";

function createPage(index: number): NotebookPage {
  return {
    id: `page-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    title: `Page ${index}`,
    ink: null,
    results: [],
    variables: {},
    updatedAt: Date.now(),
  };
}

function createNotebook(): StoredNotebook {
  const firstPage = createPage(1);
  return {
    activePageId: firstPage.id,
    pages: [firstPage],
  };
}

function loadStoredNotebook(): StoredNotebook {
  if (typeof window === "undefined") {
    return createNotebook();
  }

  try {
    const storedNotebook = window.localStorage.getItem(STORAGE_KEY);
    if (!storedNotebook) {
      return createNotebook();
    }

    const parsedNotebook = JSON.parse(storedNotebook) as StoredNotebook;
    const pages = Array.isArray(parsedNotebook.pages) ? parsedNotebook.pages : [];
    if (pages.length === 0) {
      return createNotebook();
    }

    const activePageId = pages.some((page) => page.id === parsedNotebook.activePageId)
      ? parsedNotebook.activePageId
      : pages[0].id;

    return {
      activePageId,
      pages: pages.map((page, index) => ({
        id: page.id || `page-${index + 1}`,
        title: page.title || `Page ${index + 1}`,
        ink: page.ink ?? null,
        results: Array.isArray(page.results) ? page.results : [],
        variables: page.variables ?? {},
        updatedAt: page.updatedAt ?? Date.now(),
      })),
    };
  } catch {
    return createNotebook();
  }
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
  const isNarrowViewport = window.innerWidth < 640;
  const estimatedAnswerWidth = isNarrowViewport ? Math.min(300, window.innerWidth - 32) : 180;
  const estimatedAnswerHeight = 70;
  const rightX = bounds.maxX + 28;
  const expressionCenterY = bounds.minY + (bounds.maxY - bounds.minY) / 2;
  const bottomSafeArea = isNarrowViewport ? (hasVariables ? 260 : 180) : 96;
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
  const [notebook, setNotebook] = useState<StoredNotebook>(loadStoredNotebook);
  const [notice, setNotice] = useState<string | null>(null);
  const [selectedResultId, setSelectedResultId] = useState<string | null>(null);
  const isRestoringPageRef = useRef(false);
  const restoreTokenRef = useRef(0);
  const {
    canvasVersion,
    getCanvasSnapshot,
    isCanvasReady,
    loadCanvasSnapshot,
  } = drawing;
  const {
    replaceState,
    results,
    variables,
  } = calculator;

  const activePage = useMemo(
    () => notebook.pages.find((page) => page.id === notebook.activePageId) ?? notebook.pages[0],
    [notebook],
  );
  const activePageRef = useRef(activePage);

  const updateActivePage = useCallback((updates: Partial<NotebookPage>) => {
    setNotebook((currentNotebook) => ({
      ...currentNotebook,
      pages: currentNotebook.pages.map((page) => (
        page.id === currentNotebook.activePageId
          ? { ...page, ...updates, updatedAt: Date.now() }
          : page
      )),
    }));
  }, []);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(notebook));
  }, [notebook]);

  useEffect(() => {
    activePageRef.current = activePage;
  }, [activePage]);

  useEffect(() => {
    const page = activePageRef.current;
    if (!isCanvasReady || !page) {
      return;
    }

    const restoreToken = restoreTokenRef.current + 1;
    restoreTokenRef.current = restoreToken;
    isRestoringPageRef.current = true;
    replaceState(page.results, page.variables);
    setSelectedResultId(null);
    setNotice(null);

    loadCanvasSnapshot(page.ink).finally(() => {
      window.setTimeout(() => {
        if (restoreTokenRef.current === restoreToken) {
          isRestoringPageRef.current = false;
        }
      }, 0);
    });
  }, [notebook.activePageId, isCanvasReady, loadCanvasSnapshot, replaceState]);

  useEffect(() => {
    if (!isCanvasReady || isRestoringPageRef.current) {
      return;
    }

    updateActivePage({
      ink: getCanvasSnapshot(),
      results,
      variables,
    });
  }, [
    canvasVersion,
    getCanvasSnapshot,
    isCanvasReady,
    results,
    updateActivePage,
    variables,
  ]);

  useEffect(() => {
    if (selectedResultId && !results.some((result) => result.id === selectedResultId)) {
      setSelectedResultId(null);
    }
  }, [results, selectedResultId]);

  const handleRun = async () => {
    const payload = drawing.getCanvasPayload();
    if (!payload) {
      setNotice("Write something on the board first.");
      calculator.setError(null);
      return;
    }

    setNotice(null);
    await calculator.calculate(
      payload.image,
      getAnswerPosition(payload.bounds, calculator.hasVariables, calculator.results),
    );
  };

  const handleReset = () => {
    drawing.resetCanvas();
    calculator.clearAll();
    setNotice(null);
  };

  const handleAddPage = () => {
    setNotebook((currentNotebook) => {
      const nextPage = createPage(currentNotebook.pages.length + 1);
      return {
        activePageId: nextPage.id,
        pages: [...currentNotebook.pages, nextPage],
      };
    });
  };

  const handleDeleteResult = (id: string) => {
    calculator.deleteResult(id);
    setSelectedResultId(null);
    setNotice("Result removed.");
  };

  const handleExport = () => {
    const canvas = drawing.canvasRef.current;
    if (!canvas || (!drawing.hasInk && calculator.results.length === 0)) {
      setNotice("Nothing to export yet.");
      return;
    }

    const link = document.createElement("a");
    link.href = exportBoardAsPng(canvas, calculator.results);
    link.download = getExportFilename(activePage?.title ?? "Math note");
    link.click();
    setNotice("Exported PNG.");
  };

  const handleCanvasPointerDown = (event: PointerEvent<HTMLCanvasElement>) => {
    if (drawing.tool === "select") {
      setSelectedResultId(null);
    }
    drawing.startDrawing(event);
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
        onPointerDown={handleCanvasPointerDown}
        onPointerMove={drawing.draw}
        onPointerUp={drawing.stopDrawing}
      />
      <PageStrip
        pages={notebook.pages}
        activePageId={notebook.activePageId}
        onAddPage={handleAddPage}
        onSelectPage={(id) => setNotebook((currentNotebook) => ({ ...currentNotebook, activePageId: id }))}
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
        onDelete={handleDeleteResult}
        onMove={calculator.moveResult}
        onSelect={setSelectedResultId}
        onCopy={setNotice}
      />
      <Toolbar
        color={drawing.color}
        tool={drawing.tool}
        strokeWidth={drawing.strokeWidth}
        canUndo={drawing.canUndo}
        canExport={drawing.hasInk || calculator.results.length > 0}
        isLoading={calculator.isLoading}
        onColorChange={drawing.setColor}
        onToolChange={drawing.setTool}
        onStrokeWidthChange={drawing.setStrokeWidth}
        onRun={handleRun}
        onExport={handleExport}
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
