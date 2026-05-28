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
  thumbnail?: string | null;
  variables: VariableMap;
  updatedAt: number;
}

interface StoredNotebook {
  activePageId: string;
  pages: NotebookPage[];
}

const STORAGE_KEY = "web-math-note:notebook:v1";
const HISTORY_LIMIT = 50;

function createPage(index: number): NotebookPage {
  return {
    id: `page-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    title: `Page ${index}`,
    ink: null,
    results: [],
    thumbnail: null,
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

function normalizeNotebook(notebook: Partial<StoredNotebook> | null | undefined): StoredNotebook {
  const pages = Array.isArray(notebook?.pages) ? notebook.pages : [];
  if (pages.length === 0) {
    return createNotebook();
  }

  const normalizedPages = pages.map((page, index) => ({
    id: page.id || `page-${index + 1}`,
    title: page.title || `Page ${index + 1}`,
    ink: page.ink ?? null,
    results: Array.isArray(page.results) ? page.results : [],
    thumbnail: page.thumbnail ?? null,
    variables: page.variables ?? {},
    updatedAt: page.updatedAt ?? Date.now(),
  }));

  const activePageId = normalizedPages.some((page) => page.id === notebook?.activePageId)
    ? String(notebook?.activePageId)
    : normalizedPages[0].id;

  return {
    activePageId,
    pages: normalizedPages,
  };
}

function cloneNotebook(notebook: StoredNotebook): StoredNotebook {
  return JSON.parse(JSON.stringify(notebook)) as StoredNotebook;
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

    return normalizeNotebook(JSON.parse(storedNotebook) as StoredNotebook);
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
  const [restoreRevision, setRestoreRevision] = useState(0);
  const [, setHistoryVersion] = useState(0);
  const [eraserCursor, setEraserCursor] = useState<Position | null>(null);
  const [selectionRect, setSelectionRect] = useState<Rect | null>(null);
  const selectionStartRef = useRef<Position | null>(null);
  const isRestoringPageRef = useRef(false);
  const restoreTokenRef = useRef(0);
  const undoStackRef = useRef<StoredNotebook[]>([]);
  const redoStackRef = useRef<StoredNotebook[]>([]);
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

  const activePage = useMemo(
    () => notebook.pages.find((page) => page.id === notebook.activePageId) ?? notebook.pages[0],
    [notebook],
  );
  const fileName = useMemo(() => getExportFilename(activePage?.title ?? "math-note"), [activePage?.title]);
  const activePageRef = useRef(activePage);
  const canUndo = undoStackRef.current.length > 0;
  const canRedo = redoStackRef.current.length > 0;

  const createCurrentNotebookSnapshot = useCallback(() => cloneNotebook({
    ...notebook,
    pages: notebook.pages.map((page) => (
      page.id === notebook.activePageId
        ? {
          ...page,
          ink: getCanvasSnapshot(),
          results,
          thumbnail: getCanvasThumbnail(),
          variables,
          updatedAt: Date.now(),
        }
        : page
    )),
  }), [getCanvasSnapshot, getCanvasThumbnail, notebook, results, variables]);

  const pushHistory = useCallback(() => {
    if (isRestoringPageRef.current) {
      return;
    }

    undoStackRef.current.push(createCurrentNotebookSnapshot());
    if (undoStackRef.current.length > HISTORY_LIMIT) {
      undoStackRef.current.shift();
    }
    redoStackRef.current = [];
    setHistoryVersion((version) => version + 1);
  }, [createCurrentNotebookSnapshot]);

  const restoreNotebook = useCallback((nextNotebook: StoredNotebook) => {
    isRestoringPageRef.current = true;
    setNotebook(cloneNotebook(nextNotebook));
    setRestoreRevision((revision) => revision + 1);
  }, []);

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

    loadCanvasSnapshot(page.ink).finally(() => {
      window.setTimeout(() => {
        if (restoreTokenRef.current === restoreToken) {
          isRestoringPageRef.current = false;
        }
      }, 0);
    });
  }, [notebook.activePageId, restoreRevision, isCanvasReady, loadCanvasSnapshot, replaceState]);

  useEffect(() => {
    if (!isCanvasReady || isRestoringPageRef.current) {
      return;
    }

    updateActivePage({
      ink: getCanvasSnapshot(),
      results,
      thumbnail: getCanvasThumbnail(),
      variables,
    });
  }, [
    canvasVersion,
    getCanvasThumbnail,
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

    pushHistory();
    setNotice(null);
    await calculator.calculate(
      payload.image,
      getAnswerPosition(payload.bounds, calculator.hasVariables, calculator.results),
    );
  };

  const handleReset = () => {
    pushHistory();
    drawing.resetCanvas();
    calculator.clearAll();
    setSelectedResultId(null);
    setNotice(null);
  };

  const handleAddPage = () => {
    pushHistory();
    setNotebook((currentNotebook) => {
      const nextPage = createPage(currentNotebook.pages.length + 1);
      return {
        activePageId: nextPage.id,
        pages: [...currentNotebook.pages, nextPage],
      };
    });
  };

  const handleSelectPage = (id: string) => {
    if (id === notebook.activePageId) {
      return;
    }

    pushHistory();
    setNotebook((currentNotebook) => ({ ...currentNotebook, activePageId: id }));
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

  const handleImportNotebook = async (file: File) => {
    try {
      const importedNotebook = normalizeNotebook(JSON.parse(await file.text()) as StoredNotebook);
      pushHistory();
      restoreNotebook(importedNotebook);
      setNotice("Imported notebook.");
    } catch {
      setNotice("Could not import notebook.");
    }
  };

  const handleUndo = useCallback(() => {
    const previousNotebook = undoStackRef.current.pop();
    if (!previousNotebook) {
      return;
    }

    redoStackRef.current.push(createCurrentNotebookSnapshot());
    restoreNotebook(previousNotebook);
    setHistoryVersion((version) => version + 1);
    setNotice("Undone.");
  }, [createCurrentNotebookSnapshot, restoreNotebook]);

  const handleRedo = useCallback(() => {
    const nextNotebook = redoStackRef.current.pop();
    if (!nextNotebook) {
      return;
    }

    undoStackRef.current.push(createCurrentNotebookSnapshot());
    restoreNotebook(nextNotebook);
    setHistoryVersion((version) => version + 1);
    setNotice("Redone.");
  }, [createCurrentNotebookSnapshot, restoreNotebook]);

  const handleCanvasPointerDown = (event: PointerEvent<HTMLCanvasElement>) => {
    if (drawing.tool === "select") {
      setSelectedResultId(null);
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
        setSelectedResultId(selectedResult?.id ?? null);
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

      if (event.key === "Escape") {
        setSelectedResultId(null);
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
  }, [drawing, handleDeleteResult, handleExport, handleRedo, handleUndo, selectedResultId]);

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
      <PageStrip
        pages={notebook.pages}
        activePageId={notebook.activePageId}
        onAddPage={handleAddPage}
        onExportNotebook={handleExportNotebook}
        onImportNotebook={handleImportNotebook}
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
        strokeWidth={drawing.strokeWidth}
        canUndo={canUndo}
        canRedo={canRedo}
        canExport={drawing.hasInk || calculator.results.length > 0}
        isLoading={calculator.isLoading}
        onColorChange={drawing.setColor}
        onToolChange={drawing.setTool}
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
