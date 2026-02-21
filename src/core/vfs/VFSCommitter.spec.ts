/**
 * VFSCommitter — Unit Tests
 * IGitRunner is mocked — no real git calls.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { VFSCommitter } from './VFSCommitter.js';
import type { IGitRunner, GitRunResult } from './VFSCommitter.types.js';

// ── Mock ──────────────────────────────────────────────────────────────────────

function makeGit(addOk = true, commitOut = '[main a1b2c3d] msg'): IGitRunner {
  return {
    run: vi.fn().mockImplementation((args: readonly string[]) => {
      if (args[0] === 'add') return { stdout: '', stderr: '', success: addOk } satisfies GitRunResult;
      return { stdout: commitOut, stderr: '', success: true } satisfies GitRunResult;
    }),
  };
}

const OPTS = { cwd: '/repo', message: 'feat: agent changes', paths: ['src/foo.ts'] };

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('VFSCommitter.commit — happy path', () => {
  let git: IGitRunner; let committer: VFSCommitter;
  beforeEach(() => { git = makeGit(); committer = new VFSCommitter(git); });

  it('returns success:true', async () => {
    const result = await committer.commit(OPTS);
    expect(result.success).toBe(true);
  });

  it('extracts SHA from commit output', async () => {
    const result = await committer.commit(OPTS);
    expect(result.sha).toBe('a1b2c3d');
  });

  it('calls git add with the right paths', async () => {
    await committer.commit(OPTS);
    expect(git.run).toHaveBeenCalledWith(
      expect.arrayContaining(['add', '--', 'src/foo.ts']),
      '/repo',
    );
  });

  it('calls git commit with the message', async () => {
    await committer.commit(OPTS);
    expect(git.run).toHaveBeenCalledWith(
      expect.arrayContaining(['commit', '-m', 'feat: agent changes']),
      '/repo',
    );
  });

  it('passes multiple paths to git add', async () => {
    await committer.commit({ ...OPTS, paths: ['a.ts', 'b.ts'] });
    const addCall = (git.run as ReturnType<typeof vi.fn>).mock.calls[0] as [string[], string];
    expect(addCall[0]).toContain('a.ts');
    expect(addCall[0]).toContain('b.ts');
  });
});

describe('VFSCommitter.commit — failure cases', () => {
  it('returns error when paths is empty', async () => {
    const committer = new VFSCommitter(makeGit());
    const result = await committer.commit({ ...OPTS, paths: [] });
    expect(result.success).toBe(false);
    expect(result.sha).toBeNull();
    expect(result.error).toBeDefined();
  });

  it('returns error when git add fails', async () => {
    const git: IGitRunner = {
      run: vi.fn().mockReturnValue({ stdout: '', stderr: 'not a git repo', success: false }),
    };
    const result = await new VFSCommitter(git).commit(OPTS);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/git add failed/);
  });

  it('returns error when git commit fails', async () => {
    const git: IGitRunner = {
      run: vi.fn().mockImplementation((args: readonly string[]) => {
        if (args[0] === 'add') return { stdout: '', stderr: '', success: true };
        return { stdout: '', stderr: 'nothing to commit', success: false };
      }),
    };
    const result = await new VFSCommitter(git).commit(OPTS);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/git commit failed/);
  });

  it('sha is null when commit output has no SHA pattern', async () => {
    const git = makeGit(true, 'On branch main — nothing to commit');
    // override commit to succeed but with weird output
    const run = git.run as ReturnType<typeof vi.fn>;
    run.mockImplementation((args: readonly string[]) => {
      if (args[0] === 'add') return { stdout: '', stderr: '', success: true };
      return { stdout: 'weird output', stderr: '', success: true };
    });
    const result = await new VFSCommitter(git).commit(OPTS);
    expect(result.success).toBe(true);
    expect(result.sha).toBeNull();
  });
});
