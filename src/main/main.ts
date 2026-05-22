import path from 'node:path';

import { APP_NAME, type BootstrapConfig } from '../shared/types';

type ElectronModule = typeof import('electron');

export interface ElectronLike {
  app: {
    whenReady: () => Promise<void>;
    on: (event: string, listener: () => void) => void;
    quit: () => void;
  };
  BrowserWindow: {
    new (options: {
      width: number;
      height: number;
      webPreferences: {
        preload: string;
        contextIsolation: boolean;
        nodeIntegration: boolean;
      };
    }): { loadFile: (file: string) => void };
    getAllWindows: () => unknown[];
  };
}

function getElectron(): ElectronModule {
  // Delay electron loading so tests can mock startup behavior without real electron runtime.
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

function createWindow(electronModule: ElectronLike): void {
  const config = getBootstrapConfig();

  const mainWindow = new electronModule.BrowserWindow({
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

export function bootstrapApp(electronModule?: ElectronLike): void {
  const runtime = electronModule ?? (getElectron() as unknown as ElectronLike);

  runtime.app.whenReady().then(() => {
    createWindow(runtime);

    runtime.app.on('activate', () => {
      if (runtime.BrowserWindow.getAllWindows().length === 0) {
        createWindow(runtime);
      }
    });
  });

  runtime.app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      runtime.app.quit();
    }
  });
}

if (require.main === module) {
  bootstrapApp();
}
