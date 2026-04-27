const { app, BrowserWindow } = require('electron');
const path = require('path');

// Logging for production debugging
process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err);
});

function createWindow() {
  const isDev = !app.isPackaged;
  
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    title: "Thought Canvas",
    backgroundColor: '#ffffff',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      webSecurity: false,
      preload: path.join(__dirname, 'preload.js')
    },
    icon: path.join(__dirname, '../build/icon.png')
  });

  // Load the app
  if (isDev) {
    win.loadURL('http://localhost:3001');
    win.webContents.openDevTools();
  } else {
    // In production, __dirname is electron/ inside the ASAR
    // dist/ is sibling to electron/
    const indexPath = path.join(__dirname, '..', 'dist', 'index.html');
    console.log("Loading production index from:", indexPath);
    win.loadFile(indexPath).catch(err => {
      console.error("Failed to load index.html:", err);
    });
  }

  // Error logging
  win.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error("Load failed:", errorCode, errorDescription);
  });

  win.removeMenu();
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
