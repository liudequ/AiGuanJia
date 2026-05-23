import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { mkdir, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { createAgentStore, type AgentEntity } from '../../src/main/storage/agent_store';

function tempHomeDir(): string {
    return mkdtempSync(join(tmpdir(), 'aiguanjia-agent-store-'));
}

function storageBaseDir(homeDir: string): string {
    return join(homeDir, '.aiguanjia', 'agents');
}

function storageIndexFile(homeDir: string): string {
    return join(storageBaseDir(homeDir), 'index.json');
}

function storageEntityFile(homeDir: string, id: string): string {
    return join(storageBaseDir(homeDir), `${id}.json`);
}

function createInput(id?: string, name?: string): Omit<AgentEntity, 'name' | 'id'> & { id?: string; name?: string } {
    return {
        ...(id ? { id } : {}),
        command: 'codex',
        argsTemplate: ['-q'],
        env: {
            DEMO: '1'
        },
        ...(name ? { name } : {})
    };
}

test('listAgents should return empty list when index does not exist', async () => {
    const homeDir = tempHomeDir();

    try {
        const store = createAgentStore({ homeDir });
        const list = await store.listAgents();

        assert.deepEqual(list, []);
    } finally {
        await rm(homeDir, { recursive: true, force: true });
    }
});

test('addAgent should persist index and entity file', async () => {
    const homeDir = tempHomeDir();

    try {
        const store = createAgentStore({ homeDir });
        const created = await store.addAgent(createInput('agent-1', 'My Agent'));

        assert.equal(created.id, 'agent-1');
        assert.equal(created.name, 'My Agent');

        const indexRaw = await readFile(storageIndexFile(homeDir), 'utf8');
        const entityRaw = await readFile(storageEntityFile(homeDir, 'agent-1'), 'utf8');

        assert.deepEqual(JSON.parse(indexRaw), {
            ids: ['agent-1']
        });
        assert.deepEqual(JSON.parse(entityRaw), created);
    } finally {
        await rm(homeDir, { recursive: true, force: true });
    }
});

test('removeAgent should delete entity file and update index', async () => {
    const homeDir = tempHomeDir();

    try {
        const store = createAgentStore({ homeDir });
        await store.addAgent(createInput('agent-1', 'Agent 1'));
        await store.addAgent(createInput('agent-2', 'Agent 2'));

        await store.removeAgent('agent-1');

        const list = await store.listAgents();
        const indexRaw = await readFile(storageIndexFile(homeDir), 'utf8');

        assert.equal(list.length, 1);
        assert.equal(list[0]?.id, 'agent-2');
        assert.deepEqual(JSON.parse(indexRaw), {
            ids: ['agent-2']
        });

        await assert.rejects(() => readFile(storageEntityFile(homeDir, 'agent-1'), 'utf8'));
    } finally {
        await rm(homeDir, { recursive: true, force: true });
    }
});

test('addAgent should assign smallest available default name when name is omitted', async () => {
    const homeDir = tempHomeDir();

    try {
        const store = createAgentStore({ homeDir });
        await store.addAgent(createInput('agent-1', 'Agent 1'));
        await store.addAgent(createInput('agent-2', 'Agent 2'));
        await store.removeAgent('agent-1');

        const created = await store.addAgent(createInput('agent-3'));
        assert.equal(created.name, 'Agent 1');
    } finally {
        await rm(homeDir, { recursive: true, force: true });
    }
});

test('addAgent should allow empty input and fill defaults', async () => {
    const homeDir = tempHomeDir();

    try {
        const store = createAgentStore({ homeDir, uuid: () => 'agent-default' });
        const created = await store.addAgent({});

        assert.equal(created.id, 'agent-default');
        assert.equal(created.name, 'Agent 1');
        assert.equal(created.command, 'codex');
        assert.deepEqual(created.argsTemplate, []);
    } finally {
        await rm(homeDir, { recursive: true, force: true });
    }
});

test('listAgents should throw AGENT_STORE_CORRUPTED when index references missing entity file', async () => {
    const homeDir = tempHomeDir();

    try {
        await mkdir(storageBaseDir(homeDir), { recursive: true });
        writeFileSync(storageIndexFile(homeDir), JSON.stringify({ ids: ['agent-missing'] }), { encoding: 'utf8', flag: 'w' });

        const store = createAgentStore({ homeDir });
        await assert.rejects(
            () => store.listAgents(),
            (error: unknown) => {
                const target = error as { code?: string };
                assert.equal(target.code, 'AGENT_STORE_CORRUPTED');
                return true;
            }
        );
    } finally {
        await rm(homeDir, { recursive: true, force: true });
    }
});

test('listAgents should throw AGENT_STORE_CORRUPTED when index contains invalid id', async () => {
    const homeDir = tempHomeDir();

    try {
        await mkdir(storageBaseDir(homeDir), { recursive: true });
        writeFileSync(storageIndexFile(homeDir), JSON.stringify({ ids: ['../evil'] }), { encoding: 'utf8', flag: 'w' });

        const store = createAgentStore({ homeDir });
        await assert.rejects(
            () => store.listAgents(),
            (error: unknown) => {
                const target = error as { code?: string };
                assert.equal(target.code, 'AGENT_STORE_CORRUPTED');
                return true;
            }
        );
    } finally {
        await rm(homeDir, { recursive: true, force: true });
    }
});

test('removeAgent should reject invalid id', async () => {
    const homeDir = tempHomeDir();

    try {
        const store = createAgentStore({ homeDir });
        await assert.rejects(() => store.removeAgent('../evil'), /invalid agent id/i);
    } finally {
        await rm(homeDir, { recursive: true, force: true });
    }
});

test('listAgents should throw AGENT_STORE_CORRUPTED when index json is invalid', async () => {
    const homeDir = tempHomeDir();

    try {
        await mkdir(storageBaseDir(homeDir), { recursive: true });
        writeFileSync(storageIndexFile(homeDir), '{"ids":', { encoding: 'utf8', flag: 'w' });

        const store = createAgentStore({ homeDir });
        await assert.rejects(
            () => store.listAgents(),
            (error: unknown) => {
                const target = error as { code?: string };
                assert.equal(target.code, 'AGENT_STORE_CORRUPTED');
                return true;
            }
        );
    } finally {
        await rm(homeDir, { recursive: true, force: true });
    }
});

test('addAgent should reject generated invalid id', async () => {
    const homeDir = tempHomeDir();

    try {
        const store = createAgentStore({
            homeDir,
            uuid: () => '../evil'
        });

        await assert.rejects(() => store.addAgent(createInput(undefined, 'Bad Agent')), /invalid agent id/i);
    } finally {
        await rm(homeDir, { recursive: true, force: true });
    }
});

test('addAgent should keep both ids when called concurrently', async () => {
    const homeDir = tempHomeDir();

    try {
        const store = createAgentStore({ homeDir });

        await Promise.all([
            store.addAgent(createInput('agent-1', 'Agent 1')),
            store.addAgent(createInput('agent-2', 'Agent 2'))
        ]);

        const list = await store.listAgents();
        const ids = list.map((item) => item.id).sort();
        assert.deepEqual(ids, ['agent-1', 'agent-2']);
    } finally {
        await rm(homeDir, { recursive: true, force: true });
    }
});
