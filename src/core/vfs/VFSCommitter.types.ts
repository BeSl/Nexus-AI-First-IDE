/**
 * VFSCommitter — Type Contracts
 *
 * After InMemoryVFS.confirm() writes staged changes to real disk,
 * VFSCommitter creates a git commit to track the agent's work.
 *
 * IGitRunner is injected — tests use a mock, production uses child_process.
 * @security Only commits paths explicitly passed in CommitOptions.paths
 */

/** Minimal git command runner — injectable for testability */
export interface IGitRunner {
  /** Runs git with given args in cwd. Never throws — errors in result. */
  run(args: readonly string[], cwd: string): GitRunResult;
}

export interface GitRunResult {
  readonly stdout: string;
  readonly stderr: string;
  readonly success: boolean;
}

export interface CommitOptions {
  /** Absolute path to git repo root */
  readonly cwd: string;
  /** Commit message */
  readonly message: string;
  /** Files to stage (relative or absolute paths) */
  readonly paths: readonly string[];
}

export interface CommitResult {
  /** Short git SHA of the new commit, or null on failure */
  readonly sha: string | null;
  readonly success: boolean;
  readonly error?: string;
}

export interface IVFSCommitter {
  /** Stage paths and create a git commit. Returns CommitResult. */
  commit(opts: CommitOptions): Promise<CommitResult>;
}
