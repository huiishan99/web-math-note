# App Packaging

This project ships best as a PWA first: the app bundle contains the React UI, while Gemini calls stay behind the FastAPI backend. That keeps `GEMINI_API_KEY` out of every browser, desktop, and mobile app package.

## Recommended Shape

- Frontend app: built from `front-end/` and installed as a PWA.
- Backend API: deployed separately with `GEMINI_API_KEY` stored as a server environment variable.
- App connection: `VITE_API_URL` points at the deployed backend.
- Private access gate: optional `BACKEND_ACCESS_TOKEN` on the backend, mirrored by `VITE_API_ACCESS_TOKEN` in a private app build.

Do not put `GEMINI_API_KEY` into `VITE_*` variables, app code, the service worker, or a native app bundle.

## Backend Setup

Generate a long private token for personal builds:

```bash
openssl rand -base64 32
```

Set these environment variables on the backend host:

```bash
GEMINI_API_KEY=your_google_genai_key
GEMINI_MODEL=gemini-2.5-flash
BACKEND_ACCESS_TOKEN=the_long_random_token
CORS_ORIGINS=https://your-app-domain.example
RATE_LIMIT_MAX_REQUESTS=20
RATE_LIMIT_WINDOW_SECONDS=60
TRUST_PROXY_HEADERS=true
```

Use `TRUST_PROXY_HEADERS=true` only when the host or reverse proxy sets `X-Forwarded-For` correctly. Otherwise leave it `false`.

## Frontend App Build

Create a local app env file:

```bash
cd front-end
cp .env.app.example .env.app.local
```

Edit `front-end/.env.app.local`:

```bash
VITE_API_URL=https://your-backend.example
VITE_API_ACCESS_TOKEN=the_long_random_token
```

Build the installable app shell:

```bash
npm run build:app
```

`build:app` fails if `VITE_API_URL` is missing or points at a non-HTTPS remote URL. Localhost is allowed for development.

Deploy `front-end/dist/` to a static HTTPS host. Then open the deployed URL and use the install button when the browser exposes one. On iOS Safari, use the browser share menu and Add to Home Screen.

To create a portable static hosting bundle:

```bash
npm run package:pwa
```

The archive is written to `artifacts/web-math-note-pwa.tar.gz` with a `.sha256` checksum file. Upload the extracted archive contents to your HTTPS static host.

## Security Checklist

- Restrict the Google API key to the Gemini or Generative Language API.
- If the backend has a stable outbound IP, restrict the key to that server IP.
- Keep billing alerts and per-project quotas enabled.
- Keep `CORS_ORIGINS` to the app's exact HTTPS origin.
- Keep rate limits on the backend, not only on the frontend.
- Rotate `BACKEND_ACCESS_TOKEN` and `GEMINI_API_KEY` if either one is exposed.
- Treat `VITE_API_ACCESS_TOKEN` as convenience for private builds, not as a public-app secret.

## Native Shells Later

Capacitor or Tauri can wrap the same `front-end/dist/` output later. The security model should stay the same: native shell calls the deployed backend, and the backend owns `GEMINI_API_KEY`.
