import test from 'node:test';
import assert from 'node:assert/strict';

import { runFlow, type StepLauncher } from '../../src/main/engine/execution_engine';

test('runFlow should stop after first failed step', async () => {
  const executedStepIds: string[] = [];

  const launcher: StepLauncher = async (step) => {
    executedStepIds.push(step.id);
    return step.id === 'step-2' ? { exitCode: 1 } : { exitCode: 0 };
  };

  const result = await runFlow(
    {
      id: 'flow-1',
      name: 'demo flow',
      steps: [
        { id: 'step-1', name: 'first step' },
        { id: 'step-2', name: 'second step' },
        { id: 'step-3', name: 'third step' }
      ]
    },
    launcher
  );

  assert.equal(result.finalStatus, 'FAILED');
  assert.equal(result.executedSteps, 2);
  assert.deepEqual(executedStepIds, ['step-1', 'step-2']);
});

test('runFlow should mark succeeded when all steps pass', async () => {
  const launcher: StepLauncher = async () => ({ exitCode: 0 });

  const result = await runFlow(
    {
      id: 'flow-2',
      name: 'success flow',
      steps: [
        { id: 'step-a', name: 'a' },
        { id: 'step-b', name: 'b' }
      ]
    },
    launcher
  );

  assert.equal(result.finalStatus, 'SUCCEEDED');
  assert.equal(result.executedSteps, 2);
});
