/**
 * Tester Agent — Type Contracts
 *
 * Generates Vitest unit tests for Coder artifacts.
 * Tests target the PUBLIC API surface only (no private internals).
 *
 * @security Test generation is read-only. Writing test files goes via VFS.
 */

import type { Artifact } from '../../core/orchestrator.types.js';

/** A single generated test file */
export interface TestFile {
  /** Absolute path where the test should be written (*.spec.ts) */
  readonly path: string;
  readonly content: string;
  /** Estimated number of test cases */
  readonly testCount: number;
}

/** Output from the Tester agent */
export interface TesterOutput {
  readonly taskId: string;
  readonly testFiles: readonly TestFile[];
  /** Artifacts ready to be written to VFS */
  readonly artifacts: readonly Artifact[];
}

export interface ITesterAgent {
  /**
   * Generate tests for a set of implementation artifacts.
   * Each source artifact gets a corresponding *.spec.ts file.
   */
  generateTests(taskId: string, artifacts: readonly Artifact[]): Promise<TesterOutput>;
}
