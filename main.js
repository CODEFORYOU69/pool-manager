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

    const env = {
      ...process.env,
      DATABASE_URL: `file:${dbPath}`,
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

    // Wait for IPC "ready" message from server
    const timeout = setTimeout(() => {
      reject(new Error("API server startup timeout (30s)"));
    }, 30000);

    apiProcess.on("message", (msg) => {
      if (msg && msg.type === "ready") {
        clearTimeout(timeout);
        console.log(`[Electron] API ready on port ${msg.port}`);
        resolve(msg.port);
      }
    });
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
