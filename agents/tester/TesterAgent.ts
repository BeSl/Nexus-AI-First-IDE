/**
 * TesterAgent — Implementation
 *
 * Generates Vitest unit test files for each implementation artifact.
 * Follows the Nexus TDD pattern: mocked deps, describe/it/expect, vi.clearAllMocks().
 *
 * @security Read-only. Test files are written via VFS, not directly to disk.
 */

import type { ILLMGateway } from '../../src/core/llm/LLMGateway.types.js';
import type { Artifact } from '../../core/orchestrator.types.js';
import type { ITesterAgent, TesterOutput, TestFile } from './tester.types.js';
import { TESTER_SYSTEM_PROMPT } from './prompts.js';

const MODEL = 'claude-sonnet-4-6';
const MAX_TOKENS = 8192;

export class TesterAgent implements ITesterAgent {
  readonly #gateway: ILLMGateway;

  constructor(gateway: ILLMGateway) {
    this.#gateway = gateway;
  }

  async generateTests(taskId: string, artifacts: readonly Artifact[]): Promise<TesterOutput> {
    const codeArtifacts = artifacts.filter((a) => a.type === 'code' || a.type === 'file');
    if (codeArtifacts.length === 0) {
      return { taskId, testFiles: [], artifacts: [] };
    }

    const codeBlock = codeArtifacts
      .map((a) => `### ${a.path}\n\`\`\`typescript\n${a.content}\n\`\`\``)
      .join('\n\n');

    const response = await this.#gateway.complete(
      [{ role: 'user', content: `Generate Vitest tests for:\n\n${codeBlock}` }],
      { system: TESTER_SYSTEM_PROMPT, model: MODEL, maxTokens: MAX_TOKENS },
    );

    const testFiles = this.#parseTestFiles(response.content);
    const testArtifacts = testFiles.map<Artifact>((f) => ({
      type: 'test',
      path: f.path,
      content: f.content,
    }));

    return { taskId, testFiles, artifacts: testArtifacts };
  }

  // ── Private ─────────────────────────────────────────────────────────────────

  #parseTestFiles(content: string): TestFile[] {
    const json = extractJSON(content);
    try {
      const parsed = JSON.parse(json) as unknown;
      if (!Array.isArray(parsed)) return [];
      return parsed.filter(isTestFile).map(normalizeTestFile);
    } catch {
      return [];
    }
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function extractJSON(text: string): string {
  const fenced = /```(?:json)?\s*([\s\S]+?)```/.exec(text);
  if (fenced) return fenced[1]!.trim();
  const bracket = text.indexOf('[');
  if (bracket !== -1) return text.slice(bracket);
  return text.trim();
}

function isTestFile(x: unknown): x is { path: string; content: string; testCount?: number } {
  return (
    typeof x === 'object' && x !== null &&
    typeof (x as Record<string, unknown>)['path'] === 'string' &&
    typeof (x as Record<string, unknown>)['content'] === 'string'
  );
}

function normalizeTestFile(f: { path: string; content: string; testCount?: number }): TestFile {
  const path = f.path.endsWith('.spec.ts') ? f.path : f.path.replace(/\.ts$/, '.spec.ts');
  return { path, content: f.content, testCount: f.testCount ?? 0 };
}
