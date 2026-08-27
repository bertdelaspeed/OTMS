# Rollcall as a desktop app

Rollcall is a pure client-side app (React + Vite, data in `localStorage`, optional
local bridge / cloud sync), which makes it a natural fit for a desktop wrapper.
Two viable paths: **Electron** (recommended here) and **Tauri**.

## Why Electron for this app

- Rollcall already ships a **Node bridge** (`server/bridge.mjs`) for PostgreSQL/MySQL.
  Electron embeds Node, so the desktop app can launch that bridge itself
  (`ELECTRON_RUN_AS_NODE=1`) — your "Database → Local server" backend works
  inside the desktop app with zero extra installation and no internet.
- The UI, localStorage persistence, Excel/PDF downloads and i18n work unchanged.
- Mature packaging for Windows (.exe / NSIS), macOS (.dmg) and Linux (.AppImage / .deb).

## Step 1 — install the tooling (on your machine)

```bash
npm install --save-dev electron electron-builder
```

## Step 2 — the wrapper files (already in this repo)

- `electron/main.cjs` — creates the window, loads `dist/index.html`, auto-starts
  the local bridge on port 8787, and maps downloads to native "Save as…" dialogs.
- `electron/preload.cjs` — exposes `window.rollcallDesktop` so the app can detect
  desktop mode later.

## Step 3 — package.json additions

```jsonc
{
  "main": "electron/main.cjs",
  "scripts": {
    "desktop:dev": "vite build && electron .",
    "desktop:dist": "vite build && electron-builder"
  },
  "build": {
    "appId": "com.rollcall.desktop",
    "productName": "Rollcall",
    "files": ["dist/**", "electron/**", "server/**", "node_modules/pg/**", "node_modules/mysql2/**"],
    "directories": { "output": "release" },
    "mac": { "category": "public.app-category.business" },
    "win": { "target": "nsis" },
    "linux": { "target": ["AppImage", "deb"] }
  }
}
```

## Step 4 — one Vite tweak

In `vite.config.ts` set `base: "./"` so `dist/index.html` resolves its assets with
relative paths when loaded from `file://` inside Electron.

## Step 5 — run / package

```bash
npm run desktop:dev    # build + open the desktop app
npm run desktop:dist   # build installers into ./release
```

## What works out of the box

- The whole UI, French/English, offline-first localStorage (stored in the OS user
  data folder, e.g. `~/.config/Rollcall`), JSON backup export/import.
- Excel (.xlsx) and PDF downloads — `main.cjs` routes them to a native Save dialog.
- Local database: the bridge starts automatically; open **Database → Local server**,
  engine Postgres or MySQL, `http://127.0.0.1:8787` — test, push, pull, auto-sync.

## One adaptation: Google Calendar OAuth

Google only accepts OAuth redirects from registered origins, and `file://` is not
one. For the desktop build, switch the consent flow to the standard
*installed-app loopback* flow:

1. In `main.cjs`, open the consent URL in the **system browser**.
2. Use `redirect_uri=http://127.0.0.1:9274/callback`.
3. Have the main process listen on that port, capture the `code`, exchange it for
   tokens, and hand them back to the app via the preload bridge.

Everything else in `src/gcal.ts` (refresh, mirroring, links) stays identical.

## The Tauri alternative

If binary size matters (Tauri ≈ 10 MB vs Electron ≈ 150 MB) and you don't need the
embedded Node bridge, [Tauri](https://tauri.app) wraps the same `dist/` in the OS
webview with a Rust shell. Caveats: the Node bridge must run as an external
process or [sidecar](https://tauri.app/develop/sidecar/), and Windows needs
WebView2. Good choice if you plan to sync only via Supabase/Firebase.

## Polish for distribution

- App icon (`build/icon.png` 512px → electron-builder converts it).
- Auto-updates with `electron-updater` + a static host or GitHub Releases.
- Code signing (Windows) and notarization (macOS) so installers aren't flagged.
