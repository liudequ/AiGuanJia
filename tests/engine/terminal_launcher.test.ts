import test from 'node:test';
import assert from 'node:assert/strict';

import { buildTerminalCommand } from '../../src/main/engine/terminal_launcher';

test('buildTerminalCommand should map wezterm to start with cwd and passthrough command', () => {
  const cmd = buildTerminalCommand('wezterm', '/repo', 'codex', ['--task', 'x']);

  assert.equal(cmd.program, 'wezterm');
  assert.deepEqual(cmd.args, ['start', '--cwd', '/repo', '--', 'codex', '--task', 'x']);
});

test('buildTerminalCommand should map iterm2 to open app args with shell wrapper', () => {
  const cmd = buildTerminalCommand('iterm2', '/repo', 'codex', ['--task', 'x']);

  assert.equal(cmd.program, 'open');
  assert.deepEqual(cmd.args, ['-a', 'iTerm', '--args', 'sh', '-lc', 'cd /repo && codex --task x']);
});

test('buildTerminalCommand should map gnome-terminal with working directory', () => {
  const cmd = buildTerminalCommand('gnome-terminal', '/repo', 'codex', ['--task', 'x']);

  assert.equal(cmd.program, 'gnome-terminal');
  assert.deepEqual(cmd.args, ['--working-directory=/repo', '--', 'codex', '--task', 'x']);
});

test('buildTerminalCommand should throw for unsupported terminal type', () => {
  assert.throws(() => {
    buildTerminalCommand('unknown', '/repo', 'codex', ['--task', 'x']);
  }, /Unsupported terminal type/);
});
