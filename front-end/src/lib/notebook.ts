import type { CalculationItem, VariableMap } from "@/types/calculator";

export interface NotebookCanvasSnapshot {
  dataUrl: string;
  width: number;
  height: number;
  x?: number;
  y?: number;
  imageWidth?: number;
  imageHeight?: number;
}

export interface NotebookPage {
  id: string;
  title: string;
  ink: NotebookCanvasSnapshot | null;
  results: CalculationItem[];
  thumbnail?: string | null;
  variables: VariableMap;
  updatedAt: number;
}

export interface StoredNotebook {
  activePageId: string;
  pages: NotebookPage[];
}

export const NOTEBOOK_STORAGE_KEY = "web-math-note:notebook:v1";

export function createPage(index: number): NotebookPage {
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

export function createNotebook(): StoredNotebook {
  const firstPage = createPage(1);
  return {
    activePageId: firstPage.id,
    pages: [firstPage],
  };
}

export function normalizeNotebook(notebook: Partial<StoredNotebook> | null | undefined): StoredNotebook {
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

export function cloneNotebook(notebook: StoredNotebook): StoredNotebook {
  return JSON.parse(JSON.stringify(notebook)) as StoredNotebook;
}

function getBrowserStorage() {
  return typeof window === "undefined" ? undefined : window.localStorage;
}

export function loadNotebookFromStorage(storage: Storage | undefined = getBrowserStorage()): StoredNotebook {
  if (!storage) {
    return createNotebook();
  }

  try {
    const storedNotebook = storage.getItem(NOTEBOOK_STORAGE_KEY);
    if (!storedNotebook) {
      return createNotebook();
    }

    return normalizeNotebook(JSON.parse(storedNotebook) as StoredNotebook);
  } catch {
    return createNotebook();
  }
}

export function saveNotebookToStorage(notebook: StoredNotebook, storage: Storage | undefined = getBrowserStorage()) {
  storage?.setItem(NOTEBOOK_STORAGE_KEY, JSON.stringify(notebook));
}
