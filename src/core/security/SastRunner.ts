/**
 * SastRunner — Static Application Security Testing Pass
 *
 * Runs NexusLinter against all code artifacts produced by CoderAgent.
 * Integrates into the Nexus Loop between Coder and Reviewer states.
 *
 * Usage:
 *   const sast = new SastRunner();
 *   const result = sast.run(artifacts);
 *   if (!result.passed) throw new Error(result.summary);
 *
 * @security Read-only — never modifies artifacts. Pure string analysis.
 */

import { NexusLinter } from '../../../agent-ts/NexusLinter.js';
import type { LintResult, LintSummary } from '../../../agent-ts/NexusLinter.js';
import type { Artifact } from '../../../core/orchestrator.types.js';

export interface SastResult {
  readonly passed: boolean;
  readonly summary: LintSummary;
  readonly fileResults: readonly LintResult[];
  /** Human-readable report — included in ReviewerAgent context */
  readonly report: string;
}

export class SastRunner {
  readonly #linter: NexusLinter;

  constructor(linter = new NexusLinter()) {
    this.#linter = linter;
  }

  /**
   * Run static analysis against all code/file artifacts.
   * @returns SastResult — passed is false if any critical violations found.
   */
  run(artifacts: readonly Artifact[]): SastResult {
    const codeArtifacts = artifacts.filter((a) => a.type === 'code' || a.type === 'file');

    const fileResults = codeArtifacts.map((a) =>
      this.#linter.lint(a.content, a.path),
    );

    const summary = NexusLinter.summarize(fileResults);
    const report = this.#buildReport(fileResults, summary);

    return { passed: summary.passed, summary, fileResults, report };
  }

  #buildReport(results: readonly LintResult[], summary: LintSummary): string {
    if (results.length === 0) return 'SAST: No code artifacts to analyze.';
    if (summary.totalViolations === 0) return 'SAST: All files passed. No violations found.';

    const lines = [
      `SAST Report — ${summary.filesWithViolations} file(s) with violations:`,
      `  Total: ${summary.totalViolations}  |  Critical: ${summary.criticalViolations}`,
      '',
    ];

    for (const r of results) {
      if (r.violations.length === 0) continue;
      lines.push(`## ${r.file}`);
      for (const v of r.violations) {
        const sev = v.severity === 'critical' ? '✗' : v.severity === 'warning' ? '⚠' : 'ℹ';
        lines.push(`  ${sev} [${v.rule}] L${v.line}: ${v.message}`);
        lines.push(`     → ${v.suggestion}`);
      }
      lines.push('');
    }

    return lines.join('\n');
  }
}
