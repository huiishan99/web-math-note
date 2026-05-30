# Devlog

## 2026-05-31 - Add lightweight test harnesses

### Changed
- Added a no-new-dependency frontend unit test path using TypeScript compilation plus Node's built-in test runner.
- Added focused frontend coverage for result formatting and MathJax routing decisions.
- Added backend `unittest` coverage for Gemini response parsing, fenced JSON, and unusable payload rejection.

### Verification
- Ran frontend unit tests.
- Ran frontend lint.
- Ran backend parser unit tests with the local backend virtual environment.

## 2026-05-30 - Add advanced Math Notes workflows

### Changed
- Added select-mode ink region editing: marquee-select handwritten ink, drag it, delete it, or solve only the selected region.
- Added Quick and Explain solver modes and pass the mode through to the Gemini prompt.
- Added active-page management controls for rename, delete, and moving pages left or right.
- Added whole-notebook PDF export alongside the existing JSON notebook export.
- Added canvas region export helpers and PDF rendering utilities for saved notebook pages.

### Verification
- Ran frontend lint and production build.
- Ran backend Python compile checks on project source files.
- Verified ink selection, drag, and delete behavior in the in-app browser.
- Verified page/PDF/mode controls are present and no console errors are reported.
- Verified 390px, 450px, 640px, 768px, 1024px, 1180px, 1280px, and 1365px layouts with no control overlap.

## 2026-05-28 - Fix responsive toolbar overlap

### Changed
- Moved the mobile stroke-width control onto its own row so it no longer overlaps Undo/Redo on narrow screens.
- Kept the bottom toolbar layout through tablet and narrow desktop widths to avoid colliding with the page strip.
- Repositioned the wide desktop toolbar to start after the page strip instead of centering over it.
- Raised mobile status and variable panels so they clear the taller bottom controls.

### Verification
- Ran frontend lint.
- Verified 390px, 450px, 640px, 768px, 1024px, 1180px, 1280px, and 1365px layouts in the in-app browser with no control overlap.

## 2026-05-28 - Add advanced notebook controls

### Changed
- Added notebook-level undo and redo history with keyboard shortcuts.
- Added eraser radius feedback and select-mode marquee selection for result blocks.
- Added accept and dismiss controls for pending AI results before assignments are saved.
- Added notebook JSON import/export plus page thumbnails in the page strip.
- Added a production PWA manifest/service-worker shell and clearer AI failure messages.

### Verification
- Ran frontend lint and production build.
- Verified 390px mobile and 1365px desktop layouts in the in-app browser.
- Verified undo and redo restore saved ink in browser testing.
- Verified the manifest link, notebook import/export controls, and canvas shell render locally.

## 2026-05-28 - Add notebook persistence and export workflow

### Changed
- Added local autosave for ink, results, variables, and active notebook pages.
- Added a lightweight page strip for creating and switching between pages.
- Added smarter answer placement that avoids existing result blocks before falling back.
- Made Select mode actionable with result selection, copy, and delete controls.
- Added PNG export for the board, ink, and rendered result text.
- Preserved page state across refreshes with localStorage-backed notebook data.

### Verification
- Ran frontend lint and production build.
- Captured mobile and desktop Chrome screenshots for the new notebook controls.
- Verified adding pages writes to localStorage in Chrome DevTools.
- Verified drawing ink autosaves and enables PNG export.

## 2026-05-28 - Add Math Notes interaction polish

### Changed
- Added pen, eraser, and select modes with a compact floating tool layout.
- Added adjustable stroke width and smoother pressure-aware ink curves.
- Preserved existing ink when the canvas resizes during mobile browser viewport changes.
- Added a subtle empty-board sample and a nonverbal solving pulse.
- Animated new answers into place and moved long natural-language answers into compact result cards.
- Added double-click result copying and copy buttons for card-style answers.

### Verification
- Ran frontend lint and production build.
- Verified 390px mobile layout with Chrome DevTools emulation and captured a mobile screenshot.
- Captured a 1365px desktop Chrome screenshot of the local app.

## 2026-05-27 - Polish whiteboard UI chrome

### Changed
- Reworked the drawing surface into a subtler dark graph-paper texture.
- Split the toolbar into lightweight floating action and color palettes.
- Increased mobile tap targets and hid the color strip scrollbar for a cleaner phone layout.
- Centered saved-variable chips on mobile and made draggable results feel more direct.

### Verification
- Ran frontend lint and production build.
- Captured 390px mobile and 1365px desktop Chrome screenshots of the local app.

## 2026-05-27 - Refine mobile toolbar responsiveness

### Changed
- Changed the mobile toolbar from a compressed desktop row into a two-row bottom palette.
- Added safe-area-aware spacing for the toolbar, status toast, variable chips, and answer placement.
- Moved the mobile status toast above saved-variable chips and added extra answer clearance when variables are present.
- Switched the app shell to dynamic viewport height for better mobile browser behavior.
- Limited mobile variable chip height so saved variables do not cover the drawing area.

### Verification
- Ran frontend lint and production build.

## 2026-05-27 - Improve responsive whiteboard layout

### Changed
- Changed inline answer text from blue to white.
- Moved the compact toolbar to the bottom on narrow screens and kept it at the top on wider screens.
- Added safer mobile positioning for answer overlays, variable chips, and status toasts.
- Made the solve button neutral white to match the result ink.

### Verification
- Ran frontend lint and production build.

## 2026-05-27 - Align text answers with MathJax typography

### Changed
- Switched natural-language answer rendering to a TeX-like serif font stack so text answers visually match MathJax results.
- Kept text answers outside MathJax to preserve spaces and wrapping.

### Verification
- Ran frontend lint and production build.

## 2026-05-27 - Improve text answer typography

### Changed
- Kept natural-language answers outside MathJax while styling them with Apple-style rounded system fonts.
- Tuned natural-language inline answer sizing and line-height so text answers preserve spaces without looking like plain browser text.

### Verification
- Ran frontend lint and production build.

## 2026-05-27 - Preserve spaces in text answers

### Changed
- Render natural-language solver results as plain text instead of LaTeX math.
- Kept MathJax rendering for math-like answers so numeric and symbolic results still look polished.

### Verification
- Ran frontend lint and production build.

## 2026-05-27 - Polish whiteboard UI

### Changed
- Reworked the top controls into a compact translucent icon toolbar.
- Added a subtle dotted canvas texture for a more note-like drawing surface.
- Restyled inline answers to feel more like math ink and less like a web card.
- Converted the variables panel into compact chips and moved status messages to a centered floating toast.

### Verification
- Ran frontend lint and production build.

## 2026-05-27 - Move toward Math Notes-style inline answers

### Changed
- Kept handwritten canvas content after solving instead of clearing the board.
- Rendered simple answers as inline `= answer` text near the handwritten expression.
- Preserved the fuller result card only for assignments or problems with solver steps.

### Verification
- Ran frontend lint and production build.

## 2026-05-27 - Tighten solver answer format

### Changed
- Updated the Gemini prompt to behave like a calculator for simple arithmetic.
- Required simple expressions such as `1 + 1 = ?` to return a short final answer with empty `steps`.
- Lowered generation temperature for more deterministic solver responses.

### Verification
- Ran backend Python compile checks.
- Sent a generated `1 + 1 = ?` image through `/calculate` and confirmed the response was `result: "2"` with empty `steps`.

## 2026-05-27 - Update Gemini default model

### Changed
- Updated the backend default Gemini model from `gemini-1.5-flash` to `gemini-2.5-flash`.
- Updated `back-end/.env.example` to match the current working Flash model.
- Added `.DS_Store` to `.gitignore` after Finder created local metadata files.

### Verification
- Confirmed the saved Gemini API key can list available Flash models.
- Confirmed `models/gemini-2.5-flash` is available for `generateContent`.

## 2026-05-24 - Refactor AI math whiteboard

### Changed
- Split the React home screen into focused whiteboard pieces: drawing canvas, toolbar, result layer, variable panel, and hooks.
- Added drawing safeguards and quality-of-life controls: empty-board protection, loading/error states, undo, draggable results, variable deletion, and black-background image export.
- Split the FastAPI calculator backend into request/response schemas, prompt construction, solver service, and response parser.
- Added structured solver status at `GET /calculate/status`.
- Improved API failure handling for missing solver configuration, provider failures, malformed images, and parser failures.
- Switched the frontend's default backend URL to `http://127.0.0.1:8900` for local in-app browser consistency.

### Security
- Removed `back-end/.env` from git tracking while keeping the local file.
- Added `.env` ignore rules and a safe `back-end/.env.example` template.

### Verification
- Ran `npm run lint`.
- Ran `npm run build`.
- Ran backend Python compile checks.
- Checked local frontend and backend smoke endpoints.

### Notes
- `google.generativeai` now reports a deprecation warning; migrate to the newer Gemini SDK in a future pass.
- The local Python runtime reports Python 3.9 support warnings from Google libraries; Python 3.10+ would be healthier.
