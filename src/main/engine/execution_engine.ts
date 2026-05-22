import type { FlowTemplate, Step, StepStatus } from '../domain/models';

export interface StepLaunchResult {
  exitCode: number;
  output?: string;
  error?: string;
}

export type StepLauncher = (step: Step, index: number) => Promise<StepLaunchResult>;

export interface ExecutionStepResult {
  stepId: string;
  status: StepStatus;
  exitCode: number;
  output?: string;
  error?: string;
}

export interface FlowExecutionResult {
  finalStatus: StepStatus;
  executedSteps: number;
  stepResults: ExecutionStepResult[];
}

export async function runFlow(template: FlowTemplate, launcher: StepLauncher): Promise<FlowExecutionResult> {
  const stepResults: ExecutionStepResult[] = [];

  for (const [index, step] of template.steps.entries()) {
    const launchResult = await launcher(step, index);
    const isFailed = launchResult.exitCode !== 0;

    stepResults.push({
      stepId: step.id,
      status: isFailed ? 'FAILED' : 'SUCCEEDED',
      exitCode: launchResult.exitCode,
      output: launchResult.output,
      error: launchResult.error
    });

    if (isFailed) {
      return {
        finalStatus: 'FAILED',
        executedSteps: stepResults.length,
        stepResults
      };
    }
  }

  return {
    finalStatus: 'SUCCEEDED',
    executedSteps: stepResults.length,
    stepResults
  };
}
