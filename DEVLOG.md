# Devlog

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
