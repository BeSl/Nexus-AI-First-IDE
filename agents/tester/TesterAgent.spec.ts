/**
 * TesterAgent — Unit Tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TesterAgent } from './TesterAgent.js';
import type { ILLMGateway, LLMResponse } from '../../src/core/llm/LLMGateway.types.js';
import type { Artifact } from '../../core/orchestrator.types.js';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const TEST_FILES = JSON.stringify([
  {
    path: 'src/auth/AuthService.spec.ts',
    content: "import { describe, it, expect } from 'vitest';\ndescribe('AuthService', () => { it('works', () => expect(true).toBe(true)); });",
    testCount: 1,
  },
]);

function makeGateway(content = TEST_FILES): ILLMGateway {
  return {
    complete: vi.fn().mockResolvedValue({
      content,
      model: 'claude-sonnet-4-6',
      usage: { inputTokens: 100, outputTokens: 200, totalTokens: 300 },
      stopReason: 'end_turn',
    } satisfies LLMResponse),
    stream: vi.fn(),
    registerTools: vi.fn(),
  };
}

const CODE_ARTIFACT: Artifact = {
  type: 'code', path: 'src/auth/AuthService.ts',
  content: 'export class AuthService { login() { return true; } }',
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('TesterAgent.generateTests — no artifacts', () => {
  it('returns empty output when no code artifacts', async () => {
    const agent = new TesterAgent(makeGateway());
    const result = await agent.generateTests('task-1', []);
    expect(result.testFiles).toHaveLength(0);
    expect(result.artifacts).toHaveLength(0);
  });

  it('skips schema-type artifacts', async () => {
    const agent = new TesterAgent(makeGateway());
    const schemaArtifact: Artifact = { type: 'schema', path: 'src/types.ts', content: '' };
    const result = await agent.generateTests('task-1', [schemaArtifact]);
    expect(result.testFiles).toHaveLength(0);
  });
});

describe('TesterAgent.generateTests — happy path', () => {
  let agent: TesterAgent;
  beforeEach(() => { agent = new TesterAgent(makeGateway()); });

  it('returns test files from LLM response', async () => {
    const result = await agent.generateTests('task-1', [CODE_ARTIFACT]);
    expect(result.testFiles).toHaveLength(1);
  });

  it('test artifact type is "test"', async () => {
    const result = await agent.generateTests('task-1', [CODE_ARTIFACT]);
    expect(result.artifacts[0]?.type).toBe('test');
  });

  it('test file path ends with .spec.ts', async () => {
    const result = await agent.generateTests('task-1', [CODE_ARTIFACT]);
    expect(result.testFiles[0]?.path).toMatch(/\.spec\.ts$/);
  });

  it('testCount is included', async () => {
    const result = await agent.generateTests('task-1', [CODE_ARTIFACT]);
    expect(result.testFiles[0]?.testCount).toBe(1);
  });
});

describe('TesterAgent.generateTests — path normalization', () => {
  it('adds .spec.ts if missing from path', async () => {
    const withoutSpec = JSON.stringify([
      { path: 'src/auth/AuthService.ts', content: '// test', testCount: 0 },
    ]);
    const agent = new TesterAgent(makeGateway(withoutSpec));
    const result = await agent.generateTests('task-1', [CODE_ARTIFACT]);
    expect(result.testFiles[0]?.path).toBe('src/auth/AuthService.spec.ts');
  });
});

describe('TesterAgent.generateTests — malformed response', () => {
  it('returns empty on invalid JSON', async () => {
    const agent = new TesterAgent(makeGateway('not json'));
    const result = await agent.generateTests('task-1', [CODE_ARTIFACT]);
    expect(result.testFiles).toHaveLength(0);
  });

  it('strips markdown code fences', async () => {
    const agent = new TesterAgent(makeGateway(`\`\`\`json\n${TEST_FILES}\n\`\`\``));
    const result = await agent.generateTests('task-1', [CODE_ARTIFACT]);
    expect(result.testFiles).toHaveLength(1);
  });
});
