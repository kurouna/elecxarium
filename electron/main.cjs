'use strict';
const { app, BrowserWindow } = require('electron');
const path = require('node:path');

const isDev = !app.isPackaged;
const portArg = process.argv.find((a) => a.startsWith('--dev-server-port='));
const DEV_PORT = portArg ? portArg.split('=')[1] : '5180';

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    backgroundColor: '#0b0e14',
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: path.join(__dirname, 'preload.cjs'),
    },
  });

  if (isDev) {
    void win.loadURL(`http://localhost:${DEV_PORT}`);
  } else {
    void win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }
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
