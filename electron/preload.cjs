/**
 * Preload — a small, safe bridge between the main process and the app.
 * The web app can detect it is running as a desktop app via window.rollcallDesktop.
 */
const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld("rollcallDesktop", {
  isDesktop: true,
  platform: process.platform,
  electron: process.versions.electron,
  chrome: process.versions.chrome,
});
