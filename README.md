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

Use Python 3.10+ for backend environments. This workspace has been verified with Python 3.12.13 and the current Google Gen AI SDK.

```bash
cd back-end
python3.12 -m venv .venv-py312
source .venv-py312/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn main:app --host localhost --port 8900 --reload
```

In Codex's bundled runtime, the equivalent venv bootstrap is:

```bash
/Users/shan/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 -m venv back-end/.venv-py312
back-end/.venv-py312/bin/python -m pip install -r back-end/requirements.txt
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
PYTHONPATH=back-end PYTHONPYCACHEPREFIX=/private/tmp/codex-pycache back-end/.venv-py312/bin/python -m unittest discover -s back-end/tests
PYTHONPYCACHEPREFIX=/private/tmp/codex-pycache back-end/.venv-py312/bin/python -m compileall -q back-end/apps back-end/main.py back-end/schema.py back-end/constants.py
```

## Notes

- The backend uses `google-genai`, imported as `from google import genai`, for Gemini Developer API calls.
- Notebook data is stored locally in the browser and can be exported as JSON or PDF from the app.
