/**
 * VFSCommitter — Stage confirmed VFS changes and create a git commit.
 *
 * Usage:
 *   const committer = new VFSCommitter(new ShellGitRunner());
 *   const vfs = new InMemoryVFS();
 *   await vfs.write(taskId, uri, content);
 *   await vfs.confirm(taskId);                   // ← writes to real disk
 *   await committer.commit({ cwd, message, paths }); // ← git commit
 *
 * @security Only touches paths in CommitOptions.paths — no glob expansion.
 */

import type { IVFSCommitter, IGitRunner, CommitOptions, CommitResult } from './VFSCommitter.types.js';

/** SHA pattern from git commit output: "[branch abc1234] message" */
const SHA_RE = /\[[\w/]+ ([0-9a-f]+)\]/;

export class VFSCommitter implements IVFSCommitter {
  readonly #git: IGitRunner;

  constructor(git: IGitRunner) {
    this.#git = git;
  }

  async commit(opts: CommitOptions): Promise<CommitResult> {
    if (opts.paths.length === 0) {
      return { sha: null, success: false, error: 'No paths to commit' };
    }

    // Stage files
    const add = this.#git.run(['add', '--', ...opts.paths], opts.cwd);
    if (!add.success) {
      return { sha: null, success: false, error: `git add failed: ${add.stderr || add.stdout}` };
    }

    // Commit
    const commit = this.#git.run(
      ['commit', '-m', opts.message, '--no-gpg-sign'],
      opts.cwd,
    );
    if (!commit.success) {
      return { sha: null, success: false, error: `git commit failed: ${commit.stderr || commit.stdout}` };
    }

    const sha = SHA_RE.exec(commit.stdout)?.[1] ?? null;
    return { sha, success: true };
  }
}

// ── Production IGitRunner ─────────────────────────────────────────────────────

import { execSync } from 'node:child_process';
import type { GitRunResult } from './VFSCommitter.types.js';

/**
 * Shell-based git runner for production use.
 * Use a mock IGitRunner in tests.
 */
export class ShellGitRunner implements IGitRunner {
  run(args: readonly string[], cwd: string): GitRunResult {
    try {
      const stdout = execSync(['git', ...args].join(' '), {
        cwd,
        encoding: 'utf-8',
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      return { stdout: stdout ?? '', stderr: '', success: true };
    } catch (e: unknown) {
      const err = e as { stdout?: string; stderr?: string; message?: string };
      return {
        stdout: err.stdout ?? '',
        stderr: err.stderr ?? err.message ?? '',
        success: false,
      };
    }
  }
}
