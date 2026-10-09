# Dependency security review (2026-10-09)

The application dependencies and build tools have been updated against the current npm and PyPI advisory feeds. Axios 1.20.0 and React Router 7.18.4 address current runtime advisories. Vite remains on its compatible 6.x release line (6.4.4); Electron is updated to 42.11.12 and electron-builder to 26.15.3. FastAPI 0.135.4 and an explicit Starlette 1.3.1 pin remove the affected backend dependency. Existing image-format restrictions, bot protection, and fail-closed AI configuration are unchanged.

Tailwind has been migrated to 4.3.3 with its Vite integration, and `tailwind-merge` to the compatible 3.7.0 line. The old Tailwind 3 glob/watcher stack and the now-unnecessary `postcss-selector-parser` override are removed. Existing theme colors and focus outlines are preserved explicitly; production CSS, responsive layouts, canvas interactions, and development hot updates are part of upgrade verification.

## Development-tool advisory removal

The two remaining upstream advisories have no patched leaf release as of this review. Instead of dismissing them or suppressing the audit, the affected dependency chains are removed:

- `braces` 3.0.3 ([GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm)) was introduced by Tailwind 3's `chokidar`, `micromatch`, and `fast-glob` dependencies. Tailwind 4's supported Vite integration no longer uses this stack. This is a genuine framework migration, not a forced incompatible replacement of the old glob APIs.
- `sprintf-js` 1.1.3 ([GHSA-hp3w-g68c-fv3c](https://github.com/advisories/GHSA-hp3w-g68c-fv3c)) was introduced through `electron-builder → app-builder-lib → @electron/get@3 → global-agent@3 → roarr`. A narrowly scoped override selects `roarr` 3.3.0 for `global-agent` 3.0.0. This preserves the existing proxy transport and logger default-export/child APIs while replacing `sprintf-js` with `fast-printf`. See the [logger release](https://github.com/gajus/roarr/releases/tag/v3.3.0). Remove this override once electron-builder adopts a dependency chain that no longer needs it.

A proposed `global-agent` 4.1.3 upgrade was rejected: comparative regression tests exposed incorrect TLS hostname verification for proxied IP-literal HTTPS targets. Keep the known-compatible proxy transport. Do not substitute an untested `@electron/get` major-version override or omit proxy dependencies: packaging must keep direct, HTTP/HTTPS proxy, and `NO_PROXY` support. The proxy regression uses local fixtures with trusted test certificates and checks certificate rejection, checksum verification, and cache behavior without contacting a third-party service.

Both packages must remain absent from `front-end/package-lock.json`. CI now runs the full npm audit, including development dependencies, alongside the runtime and backend regressions. A zero audit is not a substitute for build, browser, and packaging tests.

No credentials, authentication settings, public AI enablement, or desktop releases are changed by this update. Desktop users need a separately built and distributed release to receive the newer Electron runtime.

## Migration verification

[The comparative CI run](https://github.com/huiishan99/web-math-note/actions/runs/37887816171) built both the pre-migration commit `30db053` and the migrated app. Desktop and mobile views, with and without class-based dark mode, matched all inspected computed styles. No screenshot pixels differed by more than 2/255 in any channel. Drawing, undo/redo, page switching, cancel/persistence, and imported-module CSS hot updates passed. The same run passed the full npm and Python audits, 15 frontend tests, 56 backend tests, 11 proxy/download scenarios, and an unpacked Linux Electron build.

The one-time old-toolchain comparison was removed from regular CI after verification, so routine checks do not reinstall the vulnerable baseline. Browser/layout/theme/canvas/HMR regression checks remain. For another intentional tooling migration, the browser script accepts `BASELINE_URL` pointing to an independently built baseline, and `VISUAL_ARTIFACT_DIR` for screenshots and style reports. Packaged-app validation does not publish a desktop release.
