import test from 'node:test';
import assert from 'node:assert/strict';

import { getBootstrapConfig } from '../../src/main/main';

test('app bootstrap config should expose core window metadata', () => {
  const config = getBootstrapConfig();

  assert.equal(config.window.width, 1280);
  assert.equal(config.window.height, 800);
  assert.equal(config.window.preloadRelativePath, 'preload.js');
  assert.equal(config.appName, 'AiGuanJia');
});
