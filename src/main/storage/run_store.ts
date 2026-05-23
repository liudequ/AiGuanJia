import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const SAFE_ID_PATTERN = /^[a-zA-Z0-9_-]+$/;

export interface RunLayout {
  runDir: string;
  flowRunFile: string;
  stepDir: string;
  stdoutLogFile: string;
  stderrLogFile: string;
  stepRunFile: string;
  stepStatusFile: string;
}

function assertSafeId(value: string, fieldName: 'runId' | 'stepId'): void {
  if (!SAFE_ID_PATTERN.test(value)) {
    throw new Error(`invalid ${fieldName}: only [a-zA-Z0-9_-] is allowed`);
  }
}

function assertValidStepIndex(stepIndex: number): void {
  if (!Number.isInteger(stepIndex) || stepIndex < 0) {
    throw new Error('invalid stepIndex: must be a non-negative integer');
  }
}

async function ensureFileInitialized(filePath: string): Promise<void> {
  try {
    await writeFile(filePath, '', { flag: 'wx' });
  } catch (error: unknown) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== 'EEXIST') {
      throw error;
    }
  }
}

export async function createRunLayout(
  projectPath: string,
  runId: string,
  stepId: string,
  stepIndex: number
): Promise<RunLayout> {
  assertSafeId(runId, 'runId');
  assertSafeId(stepId, 'stepId');
  assertValidStepIndex(stepIndex);

  const runDir = join(projectPath, '.aiguanjia', 'runs', runId);
  const flowRunFile = join(runDir, 'flow-run.json');
  const stepDir = join(runDir, 'steps', `${stepIndex}-${stepId}`);
  const stdoutLogFile = join(stepDir, 'stdout.log');
  const stderrLogFile = join(stepDir, 'stderr.log');
  const stepRunFile = join(stepDir, 'step-run.json');
  const stepStatusFile = join(stepDir, 'step-status.json');

  await mkdir(stepDir, { recursive: true });

  await Promise.all([
    ensureFileInitialized(flowRunFile),
    writeFile(stdoutLogFile, '', { flag: 'a' }),
    writeFile(stderrLogFile, '', { flag: 'a' }),
    writeFile(stepRunFile, '', { flag: 'w' }),
    writeFile(stepStatusFile, '', { flag: 'w' })
  ]);

  return {
    runDir,
    flowRunFile,
    stepDir,
    stdoutLogFile,
    stderrLogFile,
    stepRunFile,
    stepStatusFile
  };
}
