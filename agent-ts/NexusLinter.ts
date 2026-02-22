/**
 * NexusLinter — AgentTS Static Analyzer
 *
 * Runs ALL_RULES against TypeScript source strings.
 * No LLM, no network — pure static analysis usable in CI pre-commit.
 *
 * Usage:
 *   const linter = new NexusLinter();
 *   const result = linter.lint(source, 'src/auth/AuthService.ts');
 *   if (!result.passed) console.error(result.violations);
 *
 * @security Read-only. Pure function over strings — no side effects.
 */

import { ALL_RULES } from './rules.js';
import type { LintResult, LintViolation, NexusRule } from './rules.types.js';

export type { LintResult } from './rules.types.js';

export class NexusLinter {
  readonly #rules: readonly NexusRule[];

  constructor(rules = ALL_RULES) {
    this.#rules = rules;
  }

  /**
   * Lint a single TypeScript source string.
   * @param source Full file content
   * @param filePath Used for error messages and AST filename hint
   */
  lint(source: string, filePath: string): LintResult {
    const lines = source.split('\n');
    const violations: LintViolation[] = [];

    for (const rule of this.#rules) {
      if (rule.checkLines) violations.push(...rule.checkLines(lines, filePath));
      if (rule.checkAST)   violations.push(...rule.checkAST(source, filePath));
    }

    return {
      file: filePath,
      violations,
      passed: !violations.some((v) => v.severity === 'critical'),
    };
  }

  /**
   * Lint multiple files at once.
   * Returns only files that have violations.
   */
  lintMany(files: ReadonlyMap<string, string>): readonly LintResult[] {
    const results: LintResult[] = [];
    for (const [path, source] of files) {
      const result = this.lint(source, path);
      if (result.violations.length > 0) results.push(result);
    }
    return results;
  }

  /** Summary across all results */
  static summarize(results: readonly LintResult[]): LintSummary {
    const total = results.reduce((n, r) => n + r.violations.length, 0);
    const critical = results.reduce(
      (n, r) => n + r.violations.filter((v) => v.severity === 'critical').length, 0,
    );
    return {
      filesWithViolations: results.length,
      totalViolations: total,
      criticalViolations: critical,
      passed: critical === 0,
    };
  }
}

export interface LintSummary {
  readonly filesWithViolations: number;
  readonly totalViolations: number;
  readonly criticalViolations: number;
  readonly passed: boolean;
}
