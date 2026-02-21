/**
 * BuildOrchestrator — Type Contracts
 *
 * Shadow build pipeline: copy project → apply agent changes → run build →
 * analyze errors → suggest auto-fix.
 *
 * @security Shadow dir is isolated from real project. Real FS only touched
 *           via VFS.confirm() after user approval, never here.
 */

/** Input for a shadow build run */
export interface ShadowBuildOptions {
  /** VFS task ID — used to fetch staged agent changes */
  readonly taskId: string;
  /** Shell command to run inside shadow dir, e.g. "npm run build" */
  readonly buildCommand: string;
  /** Absolute path to real project root */
  readonly projectRoot: string;
  /** Max ms to wait for build process (default 120_000) */
  readonly timeoutMs?: number;
}

/** A single compiler/linter error extracted from build output */
export interface BuildError {
  readonly file: string;
  readonly line: number;
  readonly column: number;
  readonly message: string;
  /** Compiler error code, e.g. "TS2345" */
  readonly code?: string;
  readonly severity: 'error' | 'warning';
}

/** A file patch suggested by the ErrorAnalyzer */
export interface FilePatch {
  readonly uri: string;
  /** Unified diff format */
  readonly patch: string;
  readonly explanation: string;
}

/** Auto-fix proposal returned when build fails */
export interface SuggestedFix {
  readonly explanation: string;
  readonly confidence: 'high' | 'medium' | 'low';
  readonly patches: readonly FilePatch[];
}

/** Final result of a shadow build run */
export interface BuildResult {
  readonly success: boolean;
  readonly taskId: string;
  readonly shadowDir: string;
  readonly buildCommand: string;
  readonly durationMs: number;
  readonly stdout: string;
  readonly stderr: string;
  readonly errors: readonly BuildError[];
  readonly suggestedFix: SuggestedFix | null;
}

// ── Interfaces for injectable components ─────────────────────────────────────

export interface IShadowFS {
  /** Copy project to shadow dir, applying staged VFS changes on top */
  prepare(projectRoot: string, taskId: string): Promise<string>;
  /** Remove shadow dir */
  cleanup(shadowDir: string): Promise<void>;
}

export interface IErrorAnalyzer {
  /** Parse raw build stdout/stderr into structured errors */
  parse(stdout: string, stderr: string): readonly BuildError[];
  /** Given errors + shadow file contents, propose a fix */
  suggest(errors: readonly BuildError[], shadowDir: string): Promise<SuggestedFix | null>;
}

/** Injectable process runner — isolates execSync for testing */
export interface IBuildRunner {
  run(
    command: string,
    cwd: string,
    timeoutMs: number
  ): { stdout: string; stderr: string; success: boolean };
}

export interface IBuildOrchestrator {
  runShadowBuild(options: ShadowBuildOptions): Promise<BuildResult>;
}
