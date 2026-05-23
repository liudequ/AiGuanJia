import { constants } from 'node:fs';
import { access, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { homedir } from 'node:os';
import { randomUUID } from 'node:crypto';

export interface AgentEntity {
    id: string;
    name: string;
    command: string;
    argsTemplate: string[];
    env?: Record<string, string>;
}

interface AgentIndex {
    ids: string[];
}

export interface AddAgentInput {
    id?: string;
    name?: string;
    command?: string;
    argsTemplate?: string[];
    env?: Record<string, string>;
}

export interface AgentStore {
    listAgents(): Promise<AgentEntity[]>;
    addAgent(input: AddAgentInput): Promise<AgentEntity>;
    removeAgent(id: string): Promise<void>;
}

export interface AgentStoreDeps {
    homeDir?: string;
    uuid?: () => string;
}

const SAFE_AGENT_ID_PATTERN = /^[A-Za-z0-9_-]+$/;

class AgentStoreCorruptedError extends Error {
    code: string;

    constructor(message: string) {
        super(message);
        this.name = 'AgentStoreCorruptedError';
        this.code = 'AGENT_STORE_CORRUPTED';
    }
}

function storageDir(homeDir: string): string {
    return join(homeDir, '.aiguanjia', 'agents');
}

function indexPath(baseDir: string): string {
    return join(baseDir, 'index.json');
}

function entityPath(baseDir: string, id: string): string {
    return join(baseDir, `${id}.json`);
}

function assertValidAgentId(id: string): void {
    if (!SAFE_AGENT_ID_PATTERN.test(id)) {
        throw new Error(`invalid agent id: only [A-Za-z0-9_-] is allowed`);
    }
}

function assertSafeIndexId(id: string): void {
    if (!SAFE_AGENT_ID_PATTERN.test(id)) {
        throw new AgentStoreCorruptedError(`Invalid agent id in index: ${id}`);
    }
}

async function readIndex(baseDir: string): Promise<AgentIndex> {
    const path = indexPath(baseDir);

    try {
        await access(path, constants.F_OK);
    } catch (error: unknown) {
        const code = (error as NodeJS.ErrnoException).code;
        if (code === 'ENOENT') {
            return { ids: [] };
        }
        throw error;
    }

    const raw = await readFile(path, 'utf8');
    let parsed: unknown;
    try {
        parsed = JSON.parse(raw) as unknown;
    } catch {
        throw new AgentStoreCorruptedError('Invalid agent index JSON');
    }

    if (!parsed || typeof parsed !== 'object' || !Array.isArray((parsed as AgentIndex).ids)) {
        throw new AgentStoreCorruptedError('Invalid agent index format');
    }

    const ids = (parsed as AgentIndex).ids;
    if (!ids.every((item) => typeof item === 'string')) {
        throw new AgentStoreCorruptedError('Invalid agent ids in index');
    }

    return { ids: [...ids] };
}

async function writeIndex(baseDir: string, index: AgentIndex): Promise<void> {
    const path = indexPath(baseDir);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, `${JSON.stringify(index, null, 2)}\n`, 'utf8');
}

function parseEntity(raw: string): AgentEntity {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') {
        throw new AgentStoreCorruptedError('Invalid agent entity format');
    }

    const value = parsed as Record<string, unknown>;
    if (
        typeof value.id !== 'string' ||
        typeof value.name !== 'string' ||
        typeof value.command !== 'string' ||
        !Array.isArray(value.argsTemplate) ||
        !value.argsTemplate.every((item) => typeof item === 'string')
    ) {
        throw new AgentStoreCorruptedError('Invalid agent entity fields');
    }

    if (value.env !== undefined) {
        if (typeof value.env !== 'object' || value.env === null || Array.isArray(value.env)) {
            throw new AgentStoreCorruptedError('Invalid agent env format');
        }

        const entries = Object.entries(value.env as Record<string, unknown>);
        if (!entries.every(([, v]) => typeof v === 'string')) {
            throw new AgentStoreCorruptedError('Invalid agent env values');
        }
    }

    return {
        id: value.id,
        name: value.name,
        command: value.command,
        argsTemplate: value.argsTemplate,
        ...(value.env ? { env: value.env as Record<string, string> } : {})
    };
}

async function readEntity(baseDir: string, id: string): Promise<AgentEntity> {
    const path = entityPath(baseDir, id);

    try {
        const raw = await readFile(path, 'utf8');
        return parseEntity(raw);
    } catch (error: unknown) {
        const code = (error as NodeJS.ErrnoException).code;
        if (code === 'ENOENT') {
            throw new AgentStoreCorruptedError(`Missing entity file for id: ${id}`);
        }

        if (error instanceof AgentStoreCorruptedError) {
            throw error;
        }

        if (error instanceof SyntaxError) {
            throw new AgentStoreCorruptedError(`Invalid JSON for agent: ${id}`);
        }

        throw error;
    }
}

async function writeEntity(baseDir: string, entity: AgentEntity): Promise<void> {
    const path = entityPath(baseDir, entity.id);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, `${JSON.stringify(entity, null, 2)}\n`, 'utf8');
}

function nextDefaultName(agents: AgentEntity[]): string {
    const used = new Set<number>();
    for (const agent of agents) {
        const match = /^Agent\s+(\d+)$/.exec(agent.name);
        if (!match) {
            continue;
        }
        const value = Number.parseInt(match[1], 10);
        if (Number.isInteger(value) && value > 0) {
            used.add(value);
        }
    }

    let n = 1;
    while (used.has(n)) {
        n += 1;
    }

    return `Agent ${n}`;
}

export function createAgentStore(deps: AgentStoreDeps = {}): AgentStore {
    const homeDir = deps.homeDir ?? homedir();
    const uuid = deps.uuid ?? randomUUID;
    const baseDir = storageDir(homeDir);
    let queue: Promise<void> = Promise.resolve();

    function runSerialized<T>(operation: () => Promise<T>): Promise<T> {
        const run = queue.then(operation, operation);
        queue = run.then(
            () => undefined,
            () => undefined
        );
        return run;
    }

    async function loadAgentsFromIds(ids: string[]): Promise<AgentEntity[]> {
        const agents: AgentEntity[] = [];
        for (const id of ids) {
            assertSafeIndexId(id);
            const entity = await readEntity(baseDir, id);
            agents.push(entity);
        }
        return agents;
    }

    return {
        async listAgents(): Promise<AgentEntity[]> {
            return runSerialized(async () => {
                const index = await readIndex(baseDir);
                return loadAgentsFromIds(index.ids);
            });
        },

        async addAgent(input: AddAgentInput): Promise<AgentEntity> {
            return runSerialized(async () => {
                const generatedId = input.id ?? uuid();
                assertValidAgentId(generatedId);

                const index = await readIndex(baseDir);
                if (index.ids.includes(generatedId)) {
                    throw new Error(`Agent id already exists: ${generatedId}`);
                }

                const existing = await loadAgentsFromIds(index.ids);
                const entity: AgentEntity = {
                    id: generatedId,
                    name: input.name ?? nextDefaultName(existing),
                    command: input.command ?? 'codex',
                    argsTemplate: [...(input.argsTemplate ?? [])],
                    ...(input.env ? { env: { ...input.env } } : {})
                };

                await writeEntity(baseDir, entity);
                try {
                    await writeIndex(baseDir, { ids: [...index.ids, generatedId] });
                } catch (error: unknown) {
                    await rm(entityPath(baseDir, generatedId), { force: true });
                    throw error;
                }
                return entity;
            });
        },

        async removeAgent(id: string): Promise<void> {
            return runSerialized(async () => {
                assertValidAgentId(id);
                const index = await readIndex(baseDir);
                const nextIds = index.ids.filter((item) => item !== id);

                if (nextIds.length === index.ids.length) {
                    return;
                }

                await writeIndex(baseDir, { ids: nextIds });

                try {
                    await rm(entityPath(baseDir, id));
                } catch (removeError: unknown) {
                    try {
                        await writeIndex(baseDir, { ids: index.ids });
                    } catch (rollbackError: unknown) {
                        const removeMessage = removeError instanceof Error ? removeError.message : String(removeError);
                        const rollbackMessage = rollbackError instanceof Error ? rollbackError.message : String(rollbackError);
                        throw new Error(
                            `Failed to remove agent entity and failed to rollback index: remove=${removeMessage}; rollback=${rollbackMessage}`
                        );
                    }

                    throw removeError;
                }
            });
        }
    };
}
