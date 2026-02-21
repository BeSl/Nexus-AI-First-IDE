/**
 * BuildFeedback — Shadow Build → Coder Agent Feedback Loop
 *
 * Converts BuildResult errors into LLMMessage[] that the Coder agent
 * can process to self-correct its code.
 *
 * Usage:
 *   const result = await buildOrchestrator.runShadowBuild(opts);
 *   if (!result.success) {
 *     const messages = BuildFeedback.toMessages(result);
 *     const fix = await coderGateway.complete(messages, { system: CODER_PROMPT });
 *   }
 *
 * @security Read-only. Does not touch VFS or real FS.
 */

import type { BuildResult, BuildError } from './BuildOrchestrator.types.js';
import type { LLMMessage } from '../llm/LLMGateway.types.js';

/** How many error lines to include before truncating */
const MAX_ERRORS = 20;

export class BuildFeedback {
  /**
   * Convert a failed BuildResult into an LLMMessage conversation
   * ready to send to the Coder agent for self-correction.
   *
   * Format:
   *   user: "Here are the build errors..."
   *   assistant: (empty — Coder will fill this)
   */
  static toMessages(result: BuildResult): readonly LLMMessage[] {
    if (result.success) return [];
    return [{ role: 'user', content: BuildFeedback.format(result) }];
  }

  /**
   * Render a human+machine-readable error summary.
   * Included in the Coder agent's context as a user message.
   */
  static format(result: BuildResult): string {
    const errors = result.errors.slice(0, MAX_ERRORS);
    const truncated = result.errors.length > MAX_ERRORS
      ? `\n... and ${result.errors.length - MAX_ERRORS} more errors.`
      : '';

    const errorLines = errors.map(formatError).join('\n');

    const fixHint = result.suggestedFix
      ? `\nSuggested fix (confidence: ${result.suggestedFix.confidence}):\n` +
        `${result.suggestedFix.explanation}\n` +
        result.suggestedFix.patches.map((p) =>
          `File: ${p.uri}\n${p.explanation}`
        ).join('\n')
      : '';

    return [
      `Shadow build FAILED (task: ${result.taskId}, duration: ${result.durationMs}ms).`,
      `Command: ${result.buildCommand}`,
      '',
      `## Errors (${result.errors.length} total)`,
      errorLines,
      truncated,
      fixHint,
      '',
      '## Your task',
      'Fix ALL errors listed above. For each error:',
      '1. Identify which file and line needs to change.',
      '2. Apply the minimal fix — do not refactor unrelated code.',
      '3. Ensure TypeScript types remain explicit (no `any`).',
    ].filter((l) => l !== undefined).join('\n');
  }

  /** Group errors by file for structured display */
  static byFile(result: BuildResult): Map<string, readonly BuildError[]> {
    const map = new Map<string, BuildError[]>();
    for (const err of result.errors) {
      const list = map.get(err.file) ?? [];
      list.push(err);
      map.set(err.file, list);
    }
    return map as Map<string, readonly BuildError[]>;
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatError(e: BuildError): string {
  const loc = `${e.file}:${e.line}:${e.column}`;
  const code = e.code ? ` [${e.code}]` : '';
  const sev = e.severity === 'warning' ? '⚠' : '✗';
  return `${sev} ${loc}${code} — ${e.message}`;
}
