/**
 * Coder Agent — Type Contracts
 *
 * Receives ArchitectOutput (interfaces) and produces implementation files.
 * On build failure, receives BuildFeedback and iterates (max MAX_RETRIES).
 *
 * @security Coder output goes to VFS — never directly to disk.
 *           All writes must be confirmed by user via VFS.confirm().
 */

import type { Artifact } from '../../core/orchestrator.types.js';
import type { ArchitectOutput } from '../architect/architect.types.js';

/** Input to the Coder agent — may include build error feedback on retries */
export interface CoderInput {
  /** Blueprint from the Architect agent */
  readonly architectOutput: ArchitectOutput;
  /** Formatted error message from BuildFeedback.format() — present on retries */
  readonly buildFeedback?: string;
  /** How many times this task has been retried (0 = first attempt) */
  readonly retryCount: number;
}

/** Output produced by the Coder agent */
export interface CoderOutput {
  readonly taskId: string;
  /** Implementation files to write to VFS */
  readonly artifacts: readonly Artifact[];
  readonly retryCount: number;
  /** true if the agent believes all errors are fixed */
  readonly confident: boolean;
}

export interface ICoderAgent {
  /**
   * Generate implementation for the given blueprint.
   * On retries, the buildFeedback contains compiler errors to fix.
   */
  implement(input: CoderInput): Promise<CoderOutput>;
}
