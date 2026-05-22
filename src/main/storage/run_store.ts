import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export interface RunLayout {
  runDir: string;
  flowRunFile: string;
  stepDir: string;
  stdoutLogFile: string;
  stderrLogFile: string;
  stepRunFile: string;
  stepStatusFile: string;
}

export async function createRunLayout(
  projectPath: string,
  runId: string,
  stepId: string,
  stepIndex: number
): Promise<RunLayout> {
  const runDir = join(projectPath, '.aiguanjia', 'runs', runId);
  const flowRunFile = join(runDir, 'flow-run.json');
  const stepDir = join(runDir, 'steps', `${stepIndex}-${stepId}`);
  const stdoutLogFile = join(stepDir, 'stdout.log');
  const stderrLogFile = join(stepDir, 'stderr.log');
  const stepRunFile = join(stepDir, 'step-run.json');
  const stepStatusFile = join(stepDir, 'step-status.json');

  await mkdir(stepDir, { recursive: true });

  await Promise.all([
    writeFile(flowRunFile, '', { flag: 'a' }),
    writeFile(stdoutLogFile, '', { flag: 'a' }),
    writeFile(stderrLogFile, '', { flag: 'a' }),
    writeFile(stepRunFile, '', { flag: 'a' }),
    writeFile(stepStatusFile, '', { flag: 'a' })
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
