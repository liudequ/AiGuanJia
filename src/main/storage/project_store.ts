import { constants } from 'node:fs';
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, dirname, isAbsolute, join } from 'node:path';
import { homedir } from 'node:os';

export interface ProjectEntry {
  path: string;
  name: string;
  addedAt: string;
  lastOpenedAt: string;
}

export interface ProjectState {
  currentProjectPath: string | null;
  projects: ProjectEntry[];
}

export interface ProjectStore {
  getProjectState(): Promise<ProjectState>;
  selectProjectByPath(absPath: string): Promise<ProjectState>;
}

export interface ProjectStoreDeps {
  homeDir?: string;
  now?: () => string;
}

function getStoragePath(homeDir: string): string {
  return join(homeDir, '.aiguanjia', 'projects.json');
}

function sortProjects(projects: ProjectEntry[]): ProjectEntry[] {
  return [...projects].sort((a, b) => b.lastOpenedAt.localeCompare(a.lastOpenedAt));
}

function normalizeState(raw: unknown): ProjectState {
  if (!raw || typeof raw !== 'object') {
    throw new Error('invalid state format');
  }

  const value = raw as { currentProjectPath?: unknown; projects?: unknown };
  const currentProjectPath = value.currentProjectPath;
  const projects = value.projects;

  if (currentProjectPath !== null && typeof currentProjectPath !== 'string') {
    throw new Error('invalid currentProjectPath');
  }

  if (!Array.isArray(projects)) {
    throw new Error('invalid projects list');
  }

  const normalizedProjects: ProjectEntry[] = projects.map((item) => {
    if (!item || typeof item !== 'object') {
      throw new Error('invalid project entry');
    }

    const project = item as { path?: unknown; name?: unknown; addedAt?: unknown; lastOpenedAt?: unknown };
    if (
      typeof project.path !== 'string' ||
      typeof project.name !== 'string' ||
      typeof project.addedAt !== 'string' ||
      typeof project.lastOpenedAt !== 'string'
    ) {
      throw new Error('invalid project fields');
    }

    return {
      path: project.path,
      name: project.name,
      addedAt: project.addedAt,
      lastOpenedAt: project.lastOpenedAt
    };
  });

  return {
    currentProjectPath: currentProjectPath ?? null,
    projects: sortProjects(normalizedProjects)
  };
}

async function readState(storagePath: string): Promise<ProjectState> {
  try {
    await access(storagePath, constants.F_OK);
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      return {
        currentProjectPath: null,
        projects: []
      };
    }

    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to access projects.json at ${storagePath}: ${message}`);
  }

  const rawContent = await readFile(storagePath, 'utf8');

  try {
    const parsed = JSON.parse(rawContent) as unknown;
    return normalizeState(parsed);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to parse projects.json at ${storagePath}: ${message}`);
  }
}

async function writeState(storagePath: string, state: ProjectState): Promise<void> {
  await mkdir(dirname(storagePath), { recursive: true });
  await writeFile(storagePath, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
}

export function createProjectStore(deps: ProjectStoreDeps = {}): ProjectStore {
  const homeDir = deps.homeDir ?? homedir();
  const now = deps.now ?? (() => new Date().toISOString());
  const storagePath = getStoragePath(homeDir);

  return {
    async getProjectState(): Promise<ProjectState> {
      return readState(storagePath);
    },

    async selectProjectByPath(absPath: string): Promise<ProjectState> {
      if (!isAbsolute(absPath)) {
        throw new Error(`Project path must be an absolute path: ${absPath}`);
      }

      const state = await readState(storagePath);
      const nowIsoString = now();

      const others = state.projects.filter((project) => project.path !== absPath);
      const previous = state.projects.find((project) => project.path === absPath);

      const selected: ProjectEntry = {
        path: absPath,
        name: previous?.name ?? basename(absPath),
        addedAt: previous?.addedAt ?? nowIsoString,
        lastOpenedAt: nowIsoString
      };

      const nextState: ProjectState = {
        currentProjectPath: absPath,
        projects: sortProjects([selected, ...others])
      };

      await writeState(storagePath, nextState);
      return nextState;
    }
  };
}
