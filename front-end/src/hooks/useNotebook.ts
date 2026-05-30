import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  cloneNotebook,
  createPage,
  loadNotebookFromStorage,
  normalizeNotebook,
  saveNotebookToStorage,
  type NotebookCanvasSnapshot,
  type NotebookPage,
  type StoredNotebook,
} from "@/lib/notebook";
import type { CalculationItem, VariableMap } from "@/types/calculator";

const HISTORY_LIMIT = 50;

interface UseNotebookOptions {
  canvasVersion: number;
  getCanvasSnapshot: () => NotebookCanvasSnapshot | null;
  getCanvasThumbnail: () => string | null;
  isCanvasReady: boolean;
  loadCanvasSnapshot: (snapshot: NotebookCanvasSnapshot | null) => Promise<void>;
  replaceState: (nextResults: CalculationItem[], nextVariables: VariableMap) => void;
  results: CalculationItem[];
  variables: VariableMap;
}

export function useNotebook({
  canvasVersion,
  getCanvasSnapshot,
  getCanvasThumbnail,
  isCanvasReady,
  loadCanvasSnapshot,
  replaceState,
  results,
  variables,
}: UseNotebookOptions) {
  const [notebook, setNotebook] = useState<StoredNotebook>(() => loadNotebookFromStorage());
  const [restoreRevision, setRestoreRevision] = useState(0);
  const [, setHistoryVersion] = useState(0);
  const activePage = useMemo(
    () => notebook.pages.find((page) => page.id === notebook.activePageId) ?? notebook.pages[0],
    [notebook],
  );
  const activePageRef = useRef(activePage);
  const isRestoringPageRef = useRef(false);
  const restoreTokenRef = useRef(0);
  const undoStackRef = useRef<StoredNotebook[]>([]);
  const redoStackRef = useRef<StoredNotebook[]>([]);
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
    saveNotebookToStorage(notebook);
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

  const addPage = useCallback(() => {
    pushHistory();
    setNotebook((currentNotebook) => {
      const nextPage = createPage(currentNotebook.pages.length + 1);
      return {
        activePageId: nextPage.id,
        pages: [...currentNotebook.pages, nextPage],
      };
    });
  }, [pushHistory]);

  const renamePage = useCallback((id: string, title: string) => {
    pushHistory();
    setNotebook((currentNotebook) => ({
      ...currentNotebook,
      pages: currentNotebook.pages.map((page) => (
        page.id === id ? { ...page, title, updatedAt: Date.now() } : page
      )),
    }));
  }, [pushHistory]);

  const deletePage = useCallback((id: string) => {
    if (notebook.pages.length <= 1) {
      return false;
    }

    pushHistory();
    setNotebook((currentNotebook) => {
      const deletedIndex = currentNotebook.pages.findIndex((page) => page.id === id);
      const nextPages = currentNotebook.pages.filter((page) => page.id !== id);
      const nextActivePage = currentNotebook.activePageId === id
        ? nextPages[Math.max(0, deletedIndex - 1)] ?? nextPages[0]
        : nextPages.find((page) => page.id === currentNotebook.activePageId) ?? nextPages[0];

      return {
        activePageId: nextActivePage.id,
        pages: nextPages,
      };
    });
    return true;
  }, [notebook.pages.length, pushHistory]);

  const movePage = useCallback((id: string, direction: -1 | 1) => {
    const previewIndex = notebook.pages.findIndex((page) => page.id === id);
    const previewNextIndex = previewIndex + direction;
    if (previewIndex < 0 || previewNextIndex < 0 || previewNextIndex >= notebook.pages.length) {
      return false;
    }

    pushHistory();
    setNotebook((currentNotebook) => {
      const currentIndex = currentNotebook.pages.findIndex((page) => page.id === id);
      const nextIndex = currentIndex + direction;
      if (currentIndex < 0 || nextIndex < 0 || nextIndex >= currentNotebook.pages.length) {
        return currentNotebook;
      }

      const pages = [...currentNotebook.pages];
      const page = pages[currentIndex];
      pages.splice(currentIndex, 1);
      pages.splice(nextIndex, 0, page);
      return {
        ...currentNotebook,
        pages,
      };
    });
    return true;
  }, [notebook.pages, pushHistory]);

  const selectPage = useCallback((id: string) => {
    if (id === notebook.activePageId || !notebook.pages.some((page) => page.id === id)) {
      return false;
    }

    pushHistory();
    setNotebook((currentNotebook) => ({ ...currentNotebook, activePageId: id }));
    return true;
  }, [notebook.activePageId, notebook.pages, pushHistory]);

  const importNotebookFromText = useCallback((text: string) => {
    const importedNotebook = normalizeNotebook(JSON.parse(text) as StoredNotebook);
    pushHistory();
    restoreNotebook(importedNotebook);
  }, [pushHistory, restoreNotebook]);

  const undo = useCallback(() => {
    const previousNotebook = undoStackRef.current.pop();
    if (!previousNotebook) {
      return false;
    }

    redoStackRef.current.push(createCurrentNotebookSnapshot());
    restoreNotebook(previousNotebook);
    setHistoryVersion((version) => version + 1);
    return true;
  }, [createCurrentNotebookSnapshot, restoreNotebook]);

  const redo = useCallback(() => {
    const nextNotebook = redoStackRef.current.pop();
    if (!nextNotebook) {
      return false;
    }

    undoStackRef.current.push(createCurrentNotebookSnapshot());
    restoreNotebook(nextNotebook);
    setHistoryVersion((version) => version + 1);
    return true;
  }, [createCurrentNotebookSnapshot, restoreNotebook]);

  return {
    notebook,
    activePage,
    canUndo,
    canRedo,
    createCurrentNotebookSnapshot,
    pushHistory,
    addPage,
    deletePage,
    importNotebookFromText,
    movePage,
    redo,
    renamePage,
    selectPage,
    undo,
  };
}
