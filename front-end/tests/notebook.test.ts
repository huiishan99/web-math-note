import * as assert from "node:assert/strict";
import { test } from "node:test";

import {
  NOTEBOOK_STORAGE_KEY,
  cloneNotebook,
  loadNotebookFromStorage,
  normalizeNotebook,
  saveNotebookToStorage,
  type StoredNotebook,
} from "../src/lib/notebook";

function createMemoryStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => Array.from(values.keys())[index] ?? null,
    removeItem: (key) => values.delete(key),
    setItem: (key, value) => values.set(key, value),
  };
}

test("normalizes imported notebooks with missing optional fields", () => {
  const notebook = normalizeNotebook({
    activePageId: "missing",
    pages: [{ id: "page-a", title: "", results: "bad" } as unknown as StoredNotebook["pages"][number]],
  });

  assert.equal(notebook.activePageId, "page-a");
  assert.equal(notebook.pages[0].title, "Page 1");
  assert.deepEqual(notebook.pages[0].results, []);
  assert.deepEqual(notebook.pages[0].variables, {});
});

test("clones notebooks without sharing mutable page state", () => {
  const notebook = normalizeNotebook({
    activePageId: "page-a",
    pages: [{
      id: "page-a",
      title: "Page A",
      ink: null,
      results: [],
      variables: { x: "4" },
      updatedAt: 1,
    }],
  });
  const clone = cloneNotebook(notebook);

  clone.pages[0].variables.x = "5";

  assert.equal(notebook.pages[0].variables.x, "4");
  assert.equal(clone.pages[0].variables.x, "5");
});

test("round trips notebooks through storage", () => {
  const storage = createMemoryStorage();
  const notebook = normalizeNotebook({
    activePageId: "page-a",
    pages: [{
      id: "page-a",
      title: "Stored",
      ink: null,
      results: [],
      variables: {},
      updatedAt: 1,
    }],
  });

  saveNotebookToStorage(notebook, storage);

  assert.ok(storage.getItem(NOTEBOOK_STORAGE_KEY));
  assert.equal(loadNotebookFromStorage(storage).pages[0].title, "Stored");
});
