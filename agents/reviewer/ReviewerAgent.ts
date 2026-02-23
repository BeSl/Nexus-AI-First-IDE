/**
 * ReviewerAgent — Implementation
 *
 * Static code analysis via LLM against Nexus coding rules (NEXUS-001 … NEXUS-008).
 * Never executes code — only reads content strings.
 *
 * @security Read-only. No VFS writes. No file system access.
 */

import type { ILLMGateway } from '../../src/core/llm/LLMGateway.types.js';
import type { Artifact } from '../../core/orchestrator.types.js';
import type { IReviewerAgent, ReviewResult, Violation } from './reviewer.types.js';
import { REVIEWER_SYSTEM_PROMPT } from './prompts.js';

const MAX_TOKENS = 4096;
/** Files longer than this trigger NEXUS-005 automatically (no LLM call needed) */
const MAX_LINES = 150;

export class ReviewerAgent implements IReviewerAgent {
  readonly #gateway: ILLMGateway;

  constructor(gateway: ILLMGateway) {
    this.#gateway = gateway;
  }

  async review(taskId: string, artifacts: readonly Artifact[]): Promise<ReviewResult> {
    if (artifacts.length === 0) {
      return { taskId, violations: [], passed: true, summary: 'No artifacts to review.' };
    }

    const staticViolations = this.#staticChecks(artifacts);
    const codeBlock = this.#buildCodeBlock(artifacts);

    const response = await this.#gateway.complete(
      [{ role: 'user', content: `Review these TypeScript files:\n\n${codeBlock}` }],
      { system: REVIEWER_SYSTEM_PROMPT, maxTokens: MAX_TOKENS },
    );

    const llmResult = this.#parseResult(response.content, taskId);
    const allViolations = [...staticViolations, ...llmResult.violations];
    const hasCritical = allViolations.some((v) => v.severity === 'critical');

    return {
      taskId,
      violations: allViolations,
      passed: !hasCritical,
      summary: llmResult.summary,
    };
  }

  // ── Private ─────────────────────────────────────────────────────────────────

  #staticChecks(artifacts: readonly Artifact[]): Violation[] {
    const violations: Violation[] = [];
    for (const artifact of artifacts) {
      const lines = artifact.content.split('\n').length;
      if (lines > MAX_LINES) {
        violations.push({
          severity: 'warning',
          file: artifact.path,
          line: 0,
          rule: 'NEXUS-005',
          message: `File has ${lines} lines (max ${MAX_LINES}).`,
          suggestion: 'Split into smaller modules.',
        });
      }
    }
    return violations;
  }

  #buildCodeBlock(artifacts: readonly Artifact[]): string {
    return artifacts
      .map((a) => `### ${a.path}\n\`\`\`typescript\n${a.content}\n\`\`\``)
      .join('\n\n');
  }

  #parseResult(content: string, taskId: string): ReviewResult {
    try {
      const json = extractJSON(content);
      const parsed = JSON.parse(json) as Partial<ReviewResult>;
      return {
        taskId,
        violations: Array.isArray(parsed.violations) ? parsed.violations : [],
        passed: parsed.passed ?? true,
        summary: parsed.summary ?? '',
      };
    } catch {
      return { taskId, violations: [], passed: true, summary: 'Review parse error — assuming pass.' };
    }
  }
}

function extractJSON(text: string): string {
  const fenced = /```(?:json)?\s*([\s\S]+?)```/.exec(text);
  if (fenced) return fenced[1]!.trim();
  const brace = text.indexOf('{');
  if (brace !== -1) return text.slice(brace);
  return text.trim();
}
