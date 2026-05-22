import test from 'node:test';
import assert from 'node:assert/strict';

import { bootstrapApp, getBootstrapConfig, type ElectronLike } from '../../src/main/main';

test('app bootstrap config should expose core window metadata', () => {
  const config = getBootstrapConfig();

  assert.equal(config.window.width, 1280);
  assert.equal(config.window.height, 800);
  assert.equal(config.window.preloadRelativePath, 'preload.js');
  assert.equal(config.appName, 'AiGuanJia');
});

test('bootstrapApp should create window after app ready and register lifecycle hooks', async () => {
  const listeners = new Map<string, () => void>();
  const createdWindows: Array<{ loadFileCalls: string[] }> = [];
  let windowCount = 0;
  let quitCalls = 0;

  class MockBrowserWindow {
    public loadFileCalls: string[] = [];

    constructor(public readonly options: unknown) {
      createdWindows.push(this);
      windowCount += 1;
    }

    loadFile(file: string): void {
      this.loadFileCalls.push(file);
    }

    static getAllWindows(): unknown[] {
      return new Array(windowCount).fill({});
    }
  }

  let resolveReady: (() => void) | undefined;
  const whenReadyPromise = new Promise<void>((resolve) => {
    resolveReady = resolve;
  });

  const mockElectron: ElectronLike = {
    app: {
      whenReady: () => whenReadyPromise,
      on: (event: string, listener: () => void) => {
        listeners.set(event, listener);
      },
      quit: () => {
        quitCalls += 1;
      }
    },
    BrowserWindow: MockBrowserWindow
  };

  bootstrapApp(mockElectron);

  assert.equal(createdWindows.length, 0);
  assert.equal(typeof listeners.get('window-all-closed'), 'function');

  resolveReady?.();
  await whenReadyPromise;
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(createdWindows.length, 1);
  assert.equal(typeof listeners.get('activate'), 'function');
  assert.equal(createdWindows[0].loadFileCalls.length, 1);

  const activateHandler = listeners.get('activate');
  assert.ok(activateHandler);

  windowCount = 0;
  activateHandler();
  assert.equal(createdWindows.length, 2);

  const closeHandler = listeners.get('window-all-closed');
  assert.ok(closeHandler);
  closeHandler();
  if (process.platform === 'darwin') {
    assert.equal(quitCalls, 0);
  } else {
    assert.equal(quitCalls, 1);
  }
});
