import test from 'node:test';
import assert from 'node:assert/strict';

import { buildTerminalCommand } from '../../src/main/engine/terminal_launcher';

test('buildTerminalCommand should map wezterm to start with cwd and passthrough command', () => {
  const cmd = buildTerminalCommand('wezterm', '/repo', 'codex', ['--task', 'x']);

  assert.equal(cmd.program, 'wezterm');
  assert.deepEqual(cmd.args, ['start', '--cwd', '/repo', '--', 'codex', '--task', 'x']);
});

test('buildTerminalCommand should safely escape iterm2 shell command with spaces and special chars', () => {
  const cmd = buildTerminalCommand('iterm2', "/repo team's app", "co'dex", ['--task', 'x y', '$(whoami)', '"quoted"']);

  assert.equal(cmd.program, 'open');
  assert.deepEqual(cmd.args, [
    '-a',
    'iTerm',
    '--args',
    'sh',
    '-lc',
    "cd '/repo team'\"'\"'s app' && 'co'\"'\"'dex' '--task' 'x y' '$(whoami)' '\"quoted\"'"
  ]);
});

test('buildTerminalCommand should map gnome-terminal with working directory', () => {
  const cmd = buildTerminalCommand('gnome-terminal', '/repo', 'codex', ['--task', 'x']);

  assert.equal(cmd.program, 'gnome-terminal');
  assert.deepEqual(cmd.args, ['--working-directory=/repo', '--', 'codex', '--task', 'x']);
});
