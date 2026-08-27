/**
 * ROLLCALL — Electron main process
 * -------------------------------
 * Turns the built web app (dist/) into a desktop application.
 *
 * Extra trick: Rollcall already ships a local database bridge (server/bridge.mjs),
 * and Electron embeds Node — so we launch that bridge as a child process using
 * ELECTRON_RUN_AS_NODE. The desktop app can then point its "Database → Local
 * server" backend at 127.0.0.1:8787 and talk to your real PostgreSQL/MySQL,
 * with no separate terminal window and no internet.
 */
const { app, BrowserWindow, shell, dialog, session } = require("electron");
const path = require("path");
const { spawn } = require("child_process");

const BRIDGE_PORT = process.env.ROLLCALL_BRIDGE_PORT || "8787";
let bridge = null;

function startBridge() {
  const script = path.join(__dirname, "..", "server", "bridge.mjs");
  try {
    bridge = spawn(process.execPath, [script, "--port", BRIDGE_PORT], {
      // ELECTRON_RUN_AS_NODE makes the Electron binary behave like plain Node,
      // so no extra Node installation is needed on the user's machine.
      env: { ...process.env, ELECTRON_RUN_AS_NODE: "1" },
      stdio: ["ignore", "inherit", "inherit"],
    });
    bridge.on("exit", () => {
      bridge = null;
    });
    console.log(`[rollcall] local bridge requested on port ${BRIDGE_PORT}`);
  } catch (e) {
    console.warn("[rollcall] could not start the bridge:", e.message);
  }
}

function stopBridge() {
  if (bridge) {
    bridge.kill();
    bridge = null;
  }
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1360,
    height: 860,
    minWidth: 1024,
    minHeight: 640,
    backgroundColor: "#0c120e", // matches the app's --color-bg, no white flash
    title: "Rollcall",
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.once("ready-to-show", () => win.show());
  win.loadFile(path.join(__dirname, "..", "dist", "index.html"));

  // External links (documentation, etc.) open in the system browser.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("https://")) shell.openExternal(url);
    return { action: "deny" };
  });

  return win;
}

app.whenReady().then(() => {
  startBridge();
  createWindow();

  // Native "Save as…" dialog for the Excel / PDF / backup downloads the app triggers.
  session.defaultSession.on("will-download", (_e, item) => {
    const suggested = item.getFilename();
    const { canceled, filePath } = dialog.showSaveDialogSync({
      defaultPath: path.join(app.getPath("downloads"), suggested),
    });
    if (canceled || !filePath) item.cancel();
    else item.setSavePath(filePath);
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  stopBridge();
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", stopBridge);
