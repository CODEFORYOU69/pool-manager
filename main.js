const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const path = require("path");
const fs = require("fs");
const { fork } = require("child_process");

let mainWindow;
let apiProcess;

const isPackaged = app.isPackaged;

function getApiPath() {
  return isPackaged
    ? path.join(process.resourcesPath, "api", "server.js")
    : path.join(__dirname, "api", "server.js");
}

function getDbPath() {
  const userDataPath = app.getPath("userData");
  return path.join(userDataPath, "taekwondo.db");
}

function startApiServer() {
  return new Promise((resolve, reject) => {
    const dbPath = getDbPath();
    const apiPath = getApiPath();

    // Lire l'URL de la base cloud (Supabase aujourd'hui, Neon historiquement).
    // On accepte les deux noms de variable pour ne pas casser les anciennes installs.
    let cloudUrl =
      process.env.SUPABASE_DATABASE_URL ||
      process.env.NEON_DATABASE_URL ||
      "";
    if (!cloudUrl) {
      const apiDir = isPackaged
        ? path.join(process.resourcesPath, "api")
        : path.join(__dirname, "api");
      for (const file of [".env.neon", ".env"]) {
        try {
          const content = fs.readFileSync(path.join(apiDir, file), "utf-8");
          const match =
            content.match(/^SUPABASE_DATABASE_URL=["']?([^"'\r\n]+)/m) ||
            content.match(/^NEON_DATABASE_URL=["']?([^"'\r\n]+)/m);
          if (match) { cloudUrl = match[1]; break; }
        } catch (e) { /* fichier absent, on continue */ }
      }
    }
    if (cloudUrl) {
      console.log("[Electron] Cloud DB URL: configured");
    } else {
      console.log("[Electron] Cloud DB URL: not found (sync disabled)");
    }

    const env = {
      ...process.env,
      DATABASE_URL: `file:${dbPath}`,
      NEON_DATABASE_URL: cloudUrl,
      SUPABASE_DATABASE_URL: cloudUrl,
      PORT: "3001",
      NODE_ENV: isPackaged ? "production" : "development",
    };

    console.log("[Electron] Starting API server...");
    console.log("[Electron] DB path:", dbPath);
    console.log("[Electron] API path:", apiPath);

    apiProcess = fork(apiPath, [], {
      env,
      stdio: ["pipe", "pipe", "pipe", "ipc"],
    });

    apiProcess.stdout.on("data", (data) => {
      console.log(`[API] ${data.toString().trim()}`);
    });

    apiProcess.stderr.on("data", (data) => {
      console.error(`[API ERR] ${data.toString().trim()}`);
    });

    apiProcess.on("error", (err) => {
      console.error("[Electron] Failed to start API:", err);
      reject(err);
    });

    apiProcess.on("exit", (code) => {
      console.log(`[Electron] API process exited with code ${code}`);
      apiProcess = null;
    });

    // Poll HTTP /health au lieu d'attendre un message IPC (le canal IPC
    // est cassé dans Electron packagé). On poll toutes les 500ms.
    const API_PORT = env.PORT || "3001";
    const MAX_WAIT_MS = 60000;
    const POLL_INTERVAL_MS = 500;
    let elapsed = 0;

    const pollHealth = () => {
      const http = require("http");
      const req = http.get(`http://127.0.0.1:${API_PORT}/health`, (res) => {
        if (res.statusCode === 200) {
          console.log(`[Electron] API ready on port ${API_PORT} (health OK)`);
          resolve(parseInt(API_PORT, 10));
        } else {
          scheduleRetry();
        }
        res.resume();
      });
      req.on("error", () => scheduleRetry());
      req.setTimeout(2000, () => { req.destroy(); scheduleRetry(); });
    };

    const scheduleRetry = () => {
      elapsed += POLL_INTERVAL_MS;
      if (elapsed >= MAX_WAIT_MS) {
        reject(new Error(`API server startup timeout (${MAX_WAIT_MS / 1000}s)`));
        return;
      }
      setTimeout(pollHealth, POLL_INTERVAL_MS);
    };

    // Écouter aussi le message IPC en fallback (marche en dev)
    apiProcess.on("message", (msg) => {
      if (msg && msg.type === "ready") {
        console.log(`[Electron] API ready via IPC on port ${msg.port}`);
        resolve(msg.port);
      }
    });

    // Démarrer le polling après 1s (laisser le temps au process de fork)
    setTimeout(pollHealth, 1000);
  });
}

function stopApiServer() {
  if (apiProcess) {
    console.log("[Electron] Stopping API server...");
    apiProcess.kill("SIGTERM");
    apiProcess = null;
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      preload: path.join(__dirname, "preload.js"),
    },
  });

  const startUrl =
    process.env.ELECTRON_START_URL ||
    `file://${path.join(__dirname, "./build/index.html")}`;

  mainWindow.loadURL(startUrl);

  // CSP policy - only allow localhost
  mainWindow.webContents.session.webRequest.onHeadersReceived(
    (details, callback) => {
      callback({
        responseHeaders: {
          ...details.responseHeaders,
          "Content-Security-Policy": [
            "default-src 'self'; script-src 'self' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' http://localhost:3001 http://* https://*;",
          ],
        },
      });
    }
  );

  // Open DevTools only in development
  if (process.env.NODE_ENV === "development") {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  try {
    await startApiServer();
    createWindow();
  } catch (err) {
    console.error("[Electron] Failed to start:", err);
    dialog.showErrorBox(
      "Erreur de démarrage",
      `L'application n'a pas pu démarrer le serveur API.\n\n${err.message}`
    );
    app.quit();
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.on("will-quit", () => {
  stopApiServer();
});

// IPC handlers for CSV file dialog
ipcMain.handle("open-file-dialog", async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ["openFile"],
    filters: [{ name: "Fichiers CSV", extensions: ["csv"] }],
  });

  if (!result.canceled && result.filePaths.length > 0) {
    try {
      const content = fs.readFileSync(result.filePaths[0], "utf-8");
      return { filePath: result.filePaths[0], content };
    } catch (error) {
      return { error: error.message };
    }
  }

  return { canceled: true };
});
