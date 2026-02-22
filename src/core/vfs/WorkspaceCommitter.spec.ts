/**
 * WorkspaceCommitter — Unit Tests
 * All I/O is mocked via IWorkspaceFs — no disk access.
 */

import { describe, it, expect, vi } from 'vitest';
import { WorkspaceCommitter } from './WorkspaceCommitter.js';
import type { IWorkspaceFs } from './WorkspaceCommitter.js';
import type { Artifact } from '../../../core/orchestrator.types.js';

function makeFsMock(): IWorkspaceFs {
  return {
    writeFile: vi.fn().mockResolvedValue(undefined),
    createDirectory: vi.fn().mockResolvedValue(undefined),
  };
}

function artifact(path: string, content = 'body'): Artifact {
  return { type: 'file', path, content };
}

const ROOT = '/workspace';

// ── commit — basic writes ─────────────────────────────────────────────────────

describe('WorkspaceCommitter.commit — basic writes', () => {
  it('writes a single file artifact', async () => {
    const fs = makeFsMock();
    const committer = new WorkspaceCommitter(fs);
    const result = await committer.commit('t1', [artifact('src/foo.ts')], ROOT);
    expect(result.written).toHaveLength(1);
    expect(result.written[0]).toBe('/workspace/src/foo.ts');
    expect(result.skipped).toHaveLength(0);
  });

  it('calls createDirectory before writeFile', async () => {
    const fs = makeFsMock();
    const committer = new WorkspaceCommitter(fs);
    await committer.commit('t1', [artifact('src/nested/bar.ts')], ROOT);
    expect(fs.createDirectory).toHaveBeenCalledWith('/workspace/src/nested');
    expect(fs.writeFile).toHaveBeenCalledWith('/workspace/src/nested/bar.ts', 'body');
  });

  it('writes content verbatim', async () => {
    const fs = makeFsMock();
    const committer = new WorkspaceCommitter(fs);
    const content = 'export const x = 42;';
    await committer.commit('t1', [artifact('a.ts', content)], ROOT);
    expect(fs.writeFile).toHaveBeenCalledWith('/workspace/a.ts', content);
  });

  it('writes multiple file artifacts', async () => {
    const fs = makeFsMock();
    const committer = new WorkspaceCommitter(fs);
    const artifacts = [artifact('a.ts'), artifact('b.ts'), artifact('c.ts')];
    const result = await committer.commit('t1', artifacts, ROOT);
    expect(result.written).toHaveLength(3);
    expect(fs.writeFile).toHaveBeenCalledTimes(3);
  });

  it('includes code-type artifacts', async () => {
    const fs = makeFsMock();
    const committer = new WorkspaceCommitter(fs);
    const codeArtifact: Artifact = { type: 'code', path: 'main.ts', content: '...' };
    const result = await committer.commit('t1', [codeArtifact], ROOT);
    expect(result.written).toHaveLength(1);
  });
});

// ── commit — skipping ─────────────────────────────────────────────────────────

describe('WorkspaceCommitter.commit — non-file artifacts', () => {
  it('skips schema-type artifacts', async () => {
    const fs = makeFsMock();
    const committer = new WorkspaceCommitter(fs);
    const schemaArtifact: Artifact = { type: 'schema', path: 'types.ts', content: '' };
    const result = await committer.commit('t1', [schemaArtifact], ROOT);
    expect(result.written).toHaveLength(0);
    expect(fs.writeFile).not.toHaveBeenCalled();
  });

  it('skips test artifacts', async () => {
    const fs = makeFsMock();
    const committer = new WorkspaceCommitter(fs);
    const testArtifact: Artifact = { type: 'test', path: 'foo.spec.ts', content: '' };
    const result = await committer.commit('t1', [testArtifact], ROOT);
    expect(result.written).toHaveLength(0);
  });

  it('returns empty result for empty artifacts array', async () => {
    const fs = makeFsMock();
    const committer = new WorkspaceCommitter(fs);
    const result = await committer.commit('t1', [], ROOT);
    expect(result.written).toHaveLength(0);
    expect(result.skipped).toHaveLength(0);
  });
});

// ── commit — security (path traversal) ───────────────────────────────────────

describe('WorkspaceCommitter.commit — path traversal guard', () => {
  it('skips paths escaping workspaceRoot', async () => {
    const fs = makeFsMock();
    const committer = new WorkspaceCommitter(fs);
    const result = await committer.commit('t1', [artifact('../../etc/passwd')], ROOT);
    expect(result.written).toHaveLength(0);
    expect(result.skipped).toContain('../../etc/passwd');
    expect(fs.writeFile).not.toHaveBeenCalled();
  });

  it('accepts absolute paths inside workspace', async () => {
    const fs = makeFsMock();
    const committer = new WorkspaceCommitter(fs);
    const result = await committer.commit('t1', [artifact('/workspace/safe.ts')], ROOT);
    expect(result.written).toHaveLength(1);
  });

  it('skips absolute paths outside workspace', async () => {
    const fs = makeFsMock();
    const committer = new WorkspaceCommitter(fs);
    const result = await committer.commit('t1', [artifact('/etc/shadow')], ROOT);
    expect(result.written).toHaveLength(0);
    expect(result.skipped).toHaveLength(1);
  });
});

// ── commit — result shape ─────────────────────────────────────────────────────

describe('WorkspaceCommitter.commit — result shape', () => {
  it('returns correct taskId', async () => {
    const fs = makeFsMock();
    const committer = new WorkspaceCommitter(fs);
    const result = await committer.commit('my-task-123', [], ROOT);
    expect(result.taskId).toBe('my-task-123');
  });
});
