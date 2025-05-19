const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const path = require("path");
const fs = require("fs");

let mainWindow;

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
  mainWindow.webContents.openDevTools();

  // En développement, on charge l'app React depuis le serveur de développement
  // En production, on charge depuis le build
  const startUrl =
    process.env.ELECTRON_START_URL ||
    `file://${path.join(__dirname, "./build/index.html")}`;

  mainWindow.loadURL(startUrl);

  // Définir une politique de sécurité du contenu (CSP) stricte
  mainWindow.webContents.session.webRequest.onHeadersReceived(
    (details, callback) => {
      callback({
        responseHeaders: {
          ...details.responseHeaders,
          "Content-Security-Policy": [
            "default-src 'self'; script-src 'self' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; connect-src 'self' http://localhost:3001 http://192.168.1.18:3001 http://* https://*;",
          ],
        },
      });
    }
  );

  // Ouvrir les outils de développement en mode dev
  if (process.env.NODE_ENV === "development") {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

app.whenReady().then(createWindow);

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

// Gestion des événements IPC pour le traitement des fichiers CSV
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
