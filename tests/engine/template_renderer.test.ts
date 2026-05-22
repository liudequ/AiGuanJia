import test from 'node:test';
import assert from 'node:assert/strict';

import { renderArgs } from '../../src/main/engine/template_renderer';

test('renderArgs should replace multiple placeholders in same args list', () => {
  const argsTemplate = [
    '--task={task}',
    '--cwd={project_path}',
    '--step={step_name}',
    'run:{task}:{step_name}'
  ];

  const rendered = renderArgs(argsTemplate, {
    task: 'build',
    project_path: '/workspace/demo',
    step_name: 'lint'
  });

  assert.deepEqual(rendered, [
    '--task=build',
    '--cwd=/workspace/demo',
    '--step=lint',
    'run:build:lint'
  ]);
});

test('renderArgs should keep placeholder text when payload key is missing', () => {
  const argsTemplate = ['--task={task}', '--step={step_name}', '--owner={owner}'];

  const rendered = renderArgs(argsTemplate, {
    task: 'test',
    step_name: 'unit'
  });

  assert.deepEqual(rendered, ['--task=test', '--step=unit', '--owner={owner}']);
});
