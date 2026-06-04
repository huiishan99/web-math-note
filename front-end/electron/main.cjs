const { app, BrowserWindow, protocol, session, shell } = require("electron");
const { readFile } = require("node:fs/promises");
const path = require("node:path");

const APP_SCHEME = "mathnote";
const APP_HOST = "app";

protocol.registerSchemesAsPrivileged([
  {
    scheme: APP_SCHEME,
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
    },
  },
]);

function getDistPath() {
  return path.join(__dirname, "..", "dist");
}

function getFilePath(requestUrl) {
  const url = new URL(requestUrl);
  const pathname = decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname);
  const filePath = path.normalize(path.join(getDistPath(), pathname));

  if (!filePath.startsWith(getDistPath())) {
    return null;
  }

  return filePath;
}

async function registerAppProtocol() {
  protocol.handle(APP_SCHEME, async (request) => {
    const filePath = getFilePath(request.url);
    if (!filePath) {
      return new Response("Not found", { status: 404 });
    }

    try {
      return new Response(await readFile(filePath), {
        headers: {
          "Content-Type": getContentType(filePath),
        },
      });
    } catch {
      return new Response("Not found", { status: 404 });
    }
  });
}

function getContentType(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  const types = {
    ".css": "text/css",
    ".html": "text/html",
    ".js": "text/javascript",
    ".json": "application/json",
    ".svg": "image/svg+xml",
    ".webmanifest": "application/manifest+json",
  };

  return types[extension] || "application/octet-stream";
}

function createWindow() {
  const window = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 900,
    minHeight: 640,
    backgroundColor: "#090a0c",
    title: "Math Note",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  window.setMenuBarVisibility(false);

  window.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("https://") || url.startsWith("mailto:")) {
      shell.openExternal(url);
    }

    return { action: "deny" };
  });

  window.webContents.on("will-navigate", (event, url) => {
    const allowedOrigin = `${APP_SCHEME}://${APP_HOST}`;
    if (!url.startsWith(allowedOrigin)) {
      event.preventDefault();
    }
  });

  window.loadURL(`${APP_SCHEME}://${APP_HOST}/index.html`);
}

app.whenReady().then(async () => {
  session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => {
    callback(false);
  });

  await registerAppProtocol();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
