import path from 'node:path';

import { APP_NAME, type BootstrapConfig } from '../shared/types';

type ElectronModule = typeof import('electron');

function getElectron(): ElectronModule {
  // Delay electron loading so pure config tests can run without electron runtime.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require('electron') as ElectronModule;
}

export function getBootstrapConfig(): BootstrapConfig {
  return {
    appName: APP_NAME,
    window: {
      width: 1280,
      height: 800,
      preloadRelativePath: 'preload.js'
    }
  };
}

function createWindow(): void {
  const { BrowserWindow } = getElectron();
  const config = getBootstrapConfig();

  const mainWindow = new BrowserWindow({
    width: config.window.width,
    height: config.window.height,
    webPreferences: {
      preload: path.join(__dirname, config.window.preloadRelativePath),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
}

export function bootstrapApp(): void {
  const { app, BrowserWindow } = getElectron();

  app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });
}

if (require.main === module) {
  bootstrapApp();
}
