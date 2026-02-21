/**
 * InMemoryVFS — Unit Tests (Phase 2.2)
 * No real disk writes — vi.mock('fs') for confirm() tests.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { InMemoryVFS } from './InMemoryVFS.js';

// Mock fs for confirm() tests
vi.mock('fs', () => ({
  readFileSync: vi.fn((path: string) => {
    if (path === '/project/existing.ts') return 'export const x = 1;';
    throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
  }),
  writeFileSync: vi.fn(),
  unlinkSync: vi.fn(),
  mkdirSync: vi.fn(),
  existsSync: vi.fn(() => true),
}));

import * as fsModule from 'fs';

// Clear all mock call counts before every test (prevent cross-test pollution)
beforeEach(() => { vi.clearAllMocks(); });

const TASK = 'task-001';
const AGENT = 'coder-agent';

describe('InMemoryVFS.write', () => {
  let vfs: InMemoryVFS;
  beforeEach(() => { vfs = new InMemoryVFS(); vi.clearAllMocks(); });

  it('returns a PendingChange with op=create for new file', async () => {
    const change = await vfs.write('/project/new.ts', 'const x = 1;', TASK, AGENT);
    expect(change.op).toBe('create');
    expect(change.uri).toBe('/project/new.ts');
    expect(change.after).toBe('const x = 1;');
    expect(change.before).toBeNull();
  });

  it('returns op=update for existing file', async () => {
    const change = await vfs.write('/project/existing.ts', 'const x = 2;', TASK, AGENT);
    expect(change.op).toBe('update');
    expect(change.before).toBe('export const x = 1;');
  });

  it('does NOT write to disk', async () => {
    await vfs.write('/project/new.ts', 'content', TASK, AGENT);
    expect(fsModule.writeFileSync).not.toHaveBeenCalled();
  });

  it('staged content is returned by read()', async () => {
    await vfs.write('/project/new.ts', 'staged content', TASK, AGENT);
    const content = await vfs.read('/project/new.ts', TASK);
    expect(content).toBe('staged content');
  });

  it('latest write wins for same file', async () => {
    await vfs.write('/project/f.ts', 'v1', TASK, AGENT);
    await vfs.write('/project/f.ts', 'v2', TASK, AGENT);
    expect(await vfs.read('/project/f.ts', TASK)).toBe('v2');
  });
});

describe('InMemoryVFS.delete', () => {
  let vfs: InMemoryVFS;
  beforeEach(() => { vfs = new InMemoryVFS(); vi.clearAllMocks(); });

  it('returns PendingChange with op=delete', async () => {
    const change = await vfs.delete('/project/existing.ts', TASK, AGENT);
    expect(change.op).toBe('delete');
    expect(change.after).toBeNull();
  });

  it('read() throws after staged delete', async () => {
    await vfs.delete('/project/existing.ts', TASK, AGENT);
    await expect(vfs.read('/project/existing.ts', TASK)).rejects.toThrow('deleted');
  });

  it('does NOT touch disk', async () => {
    await vfs.delete('/project/existing.ts', TASK, AGENT);
    expect(fsModule.unlinkSync).not.toHaveBeenCalled();
  });
});

describe('InMemoryVFS.getChangeSet', () => {
  it('returns all staged changes for a task', async () => {
    const vfs = new InMemoryVFS();
    await vfs.write('/a.ts', 'a', TASK, AGENT);
    await vfs.write('/b.ts', 'b', TASK, AGENT);
    const cs = await vfs.getChangeSet(TASK);
    expect(cs.changes).toHaveLength(2);
    expect(cs.status).toBe('staged');
    expect(cs.taskId).toBe(TASK);
  });

  it('returns empty changes for unknown task', async () => {
    const vfs = new InMemoryVFS();
    const cs = await vfs.getChangeSet('unknown');
    expect(cs.changes).toHaveLength(0);
  });
});

describe('InMemoryVFS.diff', () => {
  it('returns correct counts', async () => {
    const vfs = new InMemoryVFS();
    await vfs.write('/project/existing.ts', 'export const x = 1;\nexport const y = 2;', TASK, AGENT);
    const d = await vfs.diff(TASK);
    expect(d.filesChanged).toBe(1);
    expect(d.linesAdded).toBeGreaterThan(0);
    expect(d.hunks[0]?.uri).toBe('/project/existing.ts');
  });
});

describe('InMemoryVFS.confirm', () => {
  it('writes staged files to real disk', async () => {
    const vfs = new InMemoryVFS();
    await vfs.write('/project/new.ts', 'const x = 1;', TASK, AGENT);
    const cs = await vfs.getChangeSet(TASK);
    await vfs.confirm(cs.id);
    expect(fsModule.writeFileSync).toHaveBeenCalledWith('/project/new.ts', 'const x = 1;', 'utf-8');
  });

  it('deletes file from disk for op=delete', async () => {
    const vfs = new InMemoryVFS();
    await vfs.delete('/project/existing.ts', TASK, AGENT);
    const cs = await vfs.getChangeSet(TASK);
    await vfs.confirm(cs.id);
    expect(fsModule.unlinkSync).toHaveBeenCalledWith('/project/existing.ts');
  });

  it('clears staged changes after confirm', async () => {
    const vfs = new InMemoryVFS();
    await vfs.write('/f.ts', 'x', TASK, AGENT);
    const cs = await vfs.getChangeSet(TASK);
    await vfs.confirm(cs.id);
    const after = await vfs.getChangeSet(TASK);
    expect(after.changes).toHaveLength(0);
  });

  it('throws for unknown changeSetId', async () => {
    const vfs = new InMemoryVFS();
    await expect(vfs.confirm('bad-id')).rejects.toThrow('Unknown changeSetId');
  });
});

describe('InMemoryVFS.reject', () => {
  it('discards all staged changes', async () => {
    const vfs = new InMemoryVFS();
    await vfs.write('/f.ts', 'x', TASK, AGENT);
    const cs = await vfs.getChangeSet(TASK);
    await vfs.reject(cs.id);
    const after = await vfs.getChangeSet(TASK);
    expect(after.changes).toHaveLength(0);
    expect(fsModule.writeFileSync).not.toHaveBeenCalled();
  });

  it('is a no-op for unknown id', async () => {
    const vfs = new InMemoryVFS();
    await expect(vfs.reject('unknown')).resolves.toBeUndefined();
  });
});
