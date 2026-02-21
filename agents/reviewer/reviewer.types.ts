/**
 * Reviewer Agent — Type Contracts
 *
 * Reviews Coder output against security, typing, and architectural rules.
 * Returns structured violations — Orchestrator decides pass/fail threshold.
 *
 * @security Reviewer is read-only. It never modifies code.
 */

import type { Artifact } from '../../core/orchestrator.types.js';

export type ViolationSeverity = 'critical' | 'warning' | 'info';

/** A single rule violation found in the code */
export interface Violation {
  readonly severity: ViolationSeverity;
  readonly file: string;
  /** 0 if not file-specific */
  readonly line: number;
  readonly rule: string;
  readonly message: string;
  readonly suggestion: string;
}

/** Full review output */
export interface ReviewResult {
  readonly taskId: string;
  readonly violations: readonly Violation[];
  /** true if no critical violations */
  readonly passed: boolean;
  /** Overall summary written by the agent */
  readonly summary: string;
}

export interface IReviewerAgent {
  /**
   * Review a set of artifacts against project rules.
   * @security Never executes code — static analysis only.
   */
  review(taskId: string, artifacts: readonly Artifact[]): Promise<ReviewResult>;
}
