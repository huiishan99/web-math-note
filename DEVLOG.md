# Devlog

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
