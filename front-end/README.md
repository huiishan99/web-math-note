# Frontend

Vite React app for the Web Math Note canvas UI.

```bash
npm install
npm run dev
```

Checks:

```bash
npm run lint
npm run test
npm run build
npm run build:app
npm run package:pwa
```

The app calls `VITE_API_URL` when set, otherwise `http://127.0.0.1:8900`.

For packaged private builds, set `VITE_API_URL` to the deployed backend. Set `VITE_API_ACCESS_TOKEN` only if the backend has `BACKEND_ACCESS_TOKEN`; this token is bundled into the built app and is a lightweight gate, not a replacement for public user authentication.
