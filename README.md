# Web Math Note

AI-assisted math notebook with a React canvas frontend and a FastAPI backend that sends handwritten math images to Gemini.

## Structure

- `front-end/`: Vite, React, TypeScript, Tailwind UI.
- `back-end/`: FastAPI calculator API and Gemini solver integration.
- `DEVLOG.md`: chronological change log for implementation batches.

## Frontend

```bash
cd front-end
npm install
npm run dev
```

Useful checks:

```bash
npm run lint
npm run test
npm run build
```

Set `VITE_API_URL` if the backend is not running at `http://127.0.0.1:8900`.

## Backend

Use Python 3.10+ for new environments. The current local virtual environment is Python 3.9 and Google packages now warn that this runtime is past their supported window.

```bash
cd back-end
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn main:app --host localhost --port 8900 --reload
```

Required backend environment:

- `GEMINI_API_KEY`: Gemini API key.
- `GEMINI_MODEL`: defaults to `gemini-2.5-flash`.
- `CORS_ORIGINS`: comma-separated allowed frontend origins.
- `MAX_IMAGE_BYTES`: request image byte limit.
- `MAX_IMAGE_PIXELS`: decoded image pixel limit.
- `SOLVER_TIMEOUT_SECONDS`: Gemini request timeout.

Backend checks:

```bash
PYTHONPATH=back-end PYTHONPYCACHEPREFIX=/private/tmp/codex-pycache back-end/.venv/bin/python -m unittest discover -s back-end/tests
PYTHONPYCACHEPREFIX=/private/tmp/codex-pycache back-end/.venv/bin/python -m compileall -q back-end/apps back-end/main.py back-end/schema.py back-end/constants.py
```

## Notes

- `google-generativeai` is pinned for reproducibility but emits a deprecation warning. Plan a provider migration to `google-genai` when the backend runtime moves to Python 3.10+.
- Notebook data is stored locally in the browser and can be exported as JSON or PDF from the app.
