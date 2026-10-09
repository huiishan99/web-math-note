# Dependency security review (2026-10-09)

The application dependencies and build tools have been updated against the current npm and PyPI advisory feeds. Axios 1.20.0 and React Router 7.18.4 address current runtime advisories. Vite remains on its compatible 6.x release line (6.4.4); Electron is updated to 42.11.12 and electron-builder to 26.15.3. FastAPI 0.135.4 and an explicit Starlette 1.3.1 pin remove the affected backend dependency. Existing image-format restrictions, bot protection, and fail-closed AI configuration are unchanged.

`postcss-selector-parser` is overridden to the patched 7.1.6 line for the Tailwind/PostCSS toolchain; production CSS generation and application tests must remain part of upgrade verification.

## Remaining upstream development-tool advisories

Two upstream packages have no published patched release as of this review:

- `braces` 3.0.3: [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm), stack exhaustion from deeply nested patterns. Reached through Tailwind's build-time glob/watcher dependencies. Do not build untrusted projects or accept untrusted glob configuration. This dependency is not shipped in the browser bundle or Electron app.
- `sprintf-js` 1.1.3: [GHSA-hp3w-g68c-fv3c](https://github.com/advisories/GHSA-hp3w-g68c-fv3c), denial of service from unbounded precision specifiers. Reached through electron-builder's download/proxy logging dependency chain. Do not accept untrusted format strings or proxy configuration in packaging jobs. This dependency is not bundled in the packaged desktop app.

These findings are retained, not dismissed or represented as fixed. Transitive parent packages may each appear as affected in npm audit; that does not mean each is a separate underlying advisory. Recheck upstream releases before future packaging or toolchain changes.

No credentials, authentication settings, public AI enablement, or desktop releases are changed by this update. Desktop users need a separately built and distributed release to receive the newer Electron runtime.
