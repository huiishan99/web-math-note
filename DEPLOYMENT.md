# Deploy Math Note on Vercel

## Architecture

One existing Vercel project hosts both parts:

- React is built into `public/` and served by Vercel's CDN.
- The stable FastAPI framework preset loads `app.py`, which imports the existing backend.
- The browser sends drawings to `/api/calculate` on its own deployment. No Render URL, new backend account, database, or cross-origin request is needed.
- Local development and packaged clients retain the original `/calculate` endpoint.
- Notebook data stays in browser storage. The selected drawing and variable context go to Gemini only when a visitor selects Solve.

This uses ordinary Vercel Functions, not the Services beta. Python is pinned to 3.12 and the frontend build requests Node 22. The root `vercel.json` excludes frontend dependencies, generated static assets, tests, and local environment files from the Python bundle.

## One-time project settings

In the existing **HuiShan's projects → math-notes-clone** project:

1. Set Root Directory to the repository root (blank / `.`), not `front-end`.
2. Use the FastAPI framework preset and Node 22. Remove old dashboard Install/Build/Output Directory overrides so the repository configuration controls the build. The frontend build outputs `public/`; do not set `front-end/dist` as the project Output Directory.
3. Keep the existing domain. Verify a preview before publishing production.

The old project's Node 20 setting needs attention because Vercel no longer accepts new Node 20 builds. The root `package.json` requests Node 22, but verify the actual build log before treating migration as complete.

## Server-only environment variables

Enter credentials yourself through the provider/Vercel secure interface. Never commit them, put them in chat, print them, or prefix them with `VITE_`.

- `GEMINI_API_KEY`: key for the intended **unbilled/free** Google AI Studio project.
- `GEMINI_MODEL`: a vision-capable model available to that project on its free tier. Existing default `gemini-2.5-flash` may be unavailable to new projects; select an available model in AI Studio and verify it with a small test. The app does not select a paid fallback.
- `TURNSTILE_SECRET_KEY`: the Cloudflare Turnstile widget's server secret.
- `TURNSTILE_ALLOWED_HOSTNAMES`: comma-separated exact frontend hostnames, without `https://`, paths, or wildcards. Include `math-notes-clone.vercel.app`. Vercel's own deployment and production hostname environment values are also accepted by the backend, but they must be allowed in the Cloudflare widget settings too.

Optional server settings remain documented in `back-end/.env.example`. `RATE_LIMIT_MAX_REQUESTS=20` and `RATE_LIMIT_WINDOW_SECONDS=60` are a short local burst guard, not per-person daily rationing. This in-memory protection is best effort across serverless instances; it is **not** a global durable quota. `TRUST_PROXY_HEADERS` need not be enabled on Vercel: the backend uses the edge-controlled `x-vercel-forwarded-for` header there. On any non-Vercel public host, set `ENV=production` so bot verification is mandatory.

Configure Production variables first. Preview should have credentials only when intentionally enabled for protected integration testing. Changing Vercel environment variables requires a fresh deployment.

## Public frontend variable

- `VITE_TURNSTILE_SITE_KEY`: the corresponding **public** Turnstile site key. This is safe in browser JavaScript.

Create a Cloudflare Turnstile **Managed** widget for the exact approved app hostnames. No DNS move to Cloudflare is needed. The app only loads the widget when Solve is clicked; it normally verifies in the background and presents interaction only when required. Page browsing, drawing, and exports remain available without verification.

Every Solve sends a fresh token. The server validates it with Cloudflare before calling Gemini, checks `action=solve` and the hostname, and rejects missing, failed, replayed, or expired tokens. If verification/configuration is unavailable, the AI call stays blocked. Only the token and widget secret are sent to Siteverify; the drawing is not sent to Cloudflare by the backend.

Do not use Cloudflare's always-pass test keys in production. Do not put `BACKEND_ACCESS_TOKEN` in `VITE_API_ACCESS_TOKEN` for a public website: any frontend variable is readable by visitors. The Vercel build deliberately clears that legacy frontend token.

## Free usage and privacy

- Vercel Hobby is for personal/noncommercial use and has usage limits.
- Gemini's free quota is separate from Vercel hosting. Keep the Google project unbilled for a hard no-payment ceiling; code cannot infer or guarantee the account's billing status. A quota response is shown clearly and is not retried or routed to a paid model.
- Turnstile and the burst guard reduce automated abuse; they cannot guarantee that every robot will be detected. Distributed or sophisticated automation can still consume free quota. If this becomes a real problem, add a separately approved durable shared limiter or stronger protection.
- Google free-tier model inputs/outputs can be used to improve its products. Google's current API terms prohibit clients directed to, or likely to be accessed by, under-18s and require paid Services for clients made available to EEA/Switzerland/UK users. An unrestricted global free math demo therefore needs an audience/region/provider decision before activation; do not assume a portfolio label removes those restrictions or that an age checkbox resolves them. Confirm supported regions and do not send sensitive or confidential content. This code change does not override provider terms.

## Validation before release

From the repository root:

```sh
python -m venv .venv
.venv/bin/pip install -r requirements.txt
PYTHONPATH=back-end .venv/bin/python -m unittest discover -s back-end/tests
ELECTRON_SKIP_BINARY_DOWNLOAD=1 npm --prefix front-end ci
npm --prefix front-end run lint
npm --prefix front-end test
VITE_API_URL=/api VITE_API_ACCESS_TOKEN= npm --prefix front-end run build -- --outDir ../public --emptyOutDir
```

Then check the intended Vercel deployment:

1. `/` loads the actual notebook UI, and static assets return successfully.
2. `/api/health` returns JSON, not `index.html`.
3. `/api/calculate/status` reports the intended model/configuration (configured means a key is present, not that its permissions are verified).
4. Calling `/api/calculate` without a Turnstile token returns 403 or setup 503 and does not call Gemini.
5. A legitimate handwritten `1 + 1` Solve succeeds with the real model after background verification. Try a second Solve too; replaying the first token must fail.
6. Block the Turnstile script/network and confirm a useful error with no AI request, then restore it and retry.
7. Test a small mobile viewport, Solve selected ink, repeated clicks, and browser refresh. The bot widget must be visible if interaction is required.
8. Review the exact deployed commit and logs without exposing drawings, keys, or tokens. Do not call deployment complete until the real end-to-end test passes.

Unit tests mock provider/verification calls; they do not prove the production account setup or model access.

## Official references

- [FastAPI on Vercel and CDN assets](https://vercel.com/docs/frameworks/backend/fastapi)
- [Vercel Hobby limits](https://vercel.com/docs/plans/hobby)
- [Vercel request headers](https://vercel.com/docs/headers/request-headers)
- [Turnstile server validation](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/)
- [Turnstile widget settings](https://developers.cloudflare.com/turnstile/get-started/client-side-rendering/widget-configurations/)
- [Gemini pricing](https://ai.google.dev/gemini-api/docs/pricing)
- [Gemini model deprecations](https://ai.google.dev/gemini-api/docs/deprecations)
- [Gemini API terms](https://ai.google.dev/gemini-api/terms)
