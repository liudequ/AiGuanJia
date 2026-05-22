import test from 'node:test';
import assert from 'node:assert/strict';

import { parseFlowTemplate, STEP_STATUS } from '../../src/main/domain/models';

test('StepStatus should expose expected enum values', () => {
  assert.deepEqual(STEP_STATUS, ['PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED', 'INTERRUPTED']);
});

test('parseFlowTemplate should reject empty steps', () => {
  assert.throws(
    () => parseFlowTemplate({ id: 'f1', name: 'x', steps: [] }),
    /steps must not be empty/
  );
});

test('parseFlowTemplate should return normalized flow template when valid', () => {
  const parsed = parseFlowTemplate({
    id: 'flow-1',
    name: 'Build flow',
    steps: [{ id: 'step-1', name: 'Run lint' }]
  });

  assert.equal(parsed.id, 'flow-1');
  assert.equal(parsed.steps.length, 1);
  assert.equal(parsed.steps[0].name, 'Run lint');
});
