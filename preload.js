const { contextBridge, ipcRenderer } = require("electron");

// Exposer des fonctions sécurisées au processus de rendu
contextBridge.exposeInMainWorld("electronAPI", {
  // Fonction pour ouvrir un dialogue de sélection de fichier CSV
  openFileDialog: () => ipcRenderer.invoke("open-file-dialog"),
});
