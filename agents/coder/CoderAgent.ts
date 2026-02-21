/**
 * CoderAgent — Implementation
 *
 * Converts ArchitectOutput (interface blueprints) into TypeScript implementations.
 * Supports retry loop: on BuildFeedback, re-sends errors to Claude for self-correction.
 *
 * @security All output goes to VFS — never touches real FS directly.
 */

import type { ILLMGateway } from '../../src/core/llm/LLMGateway.types.js';
import type { IAgentToolkit } from '../../src/core/llm/AgentToolkit.types.js';
import type { Artifact } from '../../core/orchestrator.types.js';
import type { ICoderAgent, CoderInput, CoderOutput } from './coder.types.js';
import { CODER_SYSTEM_PROMPT, CODER_RETRY_PROMPT } from './prompts.js';

const MODEL = 'claude-sonnet-4-6';
const MAX_TOKENS = 8192;

export class CoderAgent implements ICoderAgent {
  readonly #gateway: ILLMGateway;
  readonly #toolkit: IAgentToolkit;

  constructor(gateway: ILLMGateway, toolkit: IAgentToolkit) {
    this.#gateway = gateway;
    this.#toolkit = toolkit;
    gateway.registerTools([...toolkit.getTools()]);
  }

  async implement(input: CoderInput): Promise<CoderOutput> {
    const taskId = input.architectOutput.agentId;
    const system = input.retryCount > 0 ? CODER_RETRY_PROMPT : CODER_SYSTEM_PROMPT;
    const userContent = this.#buildPrompt(input);

    const response = await this.#gateway.complete(
      [{ role: 'user', content: userContent }],
      { system, model: MODEL, maxTokens: MAX_TOKENS },
    );

    const fileSpecs = this.#parseFileSpecs(response.content);
    const artifacts = fileSpecs.map<Artifact>((f) => ({
      type: 'code',
      path: f.path,
      content: f.content,
    }));

    return {
      taskId,
      artifacts,
      retryCount: input.retryCount,
      confident: input.retryCount === 0 || fileSpecs.length > 0,
    };
  }

  // ── Private ─────────────────────────────────────────────────────────────────

  #buildPrompt(input: CoderInput): string {
    const { architectOutput, buildFeedback } = input;
    const intent = architectOutput.intent;

    const interfaceBlock = architectOutput.artifacts
      .map((a) => `### ${a.path}\n\`\`\`typescript\n${a.content}\n\`\`\``)
      .join('\n\n');

    const feedbackBlock = buildFeedback
      ? `\n\n## Build Errors to Fix\n${buildFeedback}`
      : '';

    return [
      `## Task: Implement "${intent.summary}"`,
      '',
      '## Interfaces to implement:',
      interfaceBlock,
      feedbackBlock,
    ].join('\n');
  }

  #parseFileSpecs(content: string): Array<{ path: string; content: string }> {
    const json = extractJSON(content);
    try {
      const parsed = JSON.parse(json) as unknown;
      if (!Array.isArray(parsed)) return [];
      return parsed.filter(isFileSpec);
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

function isFileSpec(x: unknown): x is { path: string; content: string } {
  return (
    typeof x === 'object' && x !== null &&
    'path' in x && typeof (x as Record<string, unknown>)['path'] === 'string' &&
    'content' in x && typeof (x as Record<string, unknown>)['content'] === 'string'
  );
}
