import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import { dirname } from 'node:path';

import { parseConfig, type AppConfig } from '../domain/models';

export async function readConfig(filePath: string): Promise<AppConfig | null> {
  try {
    await access(filePath, constants.F_OK);
  } catch {
    return null;
  }

  const content = await readFile(filePath, 'utf8');
  const parsed = JSON.parse(content) as unknown;
  return parseConfig(parsed);
}

export async function writeConfig(filePath: string, config: AppConfig): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(config, null, 2)}\n`, 'utf8');
}
