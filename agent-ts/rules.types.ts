/**
 * AgentTS — Lint Rule Types
 *
 * All NEXUS rules produce LintViolation[] — same shape as ReviewerAgent.Violation
 * so they can be merged and displayed uniformly.
 *
 * @security Rule checks are read-only. No file mutations.
 */

export type ViolationSeverity = 'critical' | 'warning' | 'info';

export interface LintViolation {
  readonly rule: string;           // e.g. "NEXUS-001"
  readonly severity: ViolationSeverity;
  readonly file: string;
  readonly line: number;           // 1-based; 0 = file-level
  readonly message: string;
  readonly suggestion: string;
}

/** A single NEXUS rule */
export interface NexusRule {
  readonly id: string;             // "NEXUS-001"
  readonly severity: ViolationSeverity;
  readonly description: string;
  /** Check source lines (fast, no AST) */
  checkLines?(lines: readonly string[], filePath: string): LintViolation[];
  /** Check full source with TypeScript AST (slower) */
  checkAST?(source: string, filePath: string): LintViolation[];
}

/** Result of linting a single file */
export interface LintResult {
  readonly file: string;
  readonly violations: readonly LintViolation[];
  readonly passed: boolean;  // true if no 'critical' violations
}
