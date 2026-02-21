/**
 * ReviewerAgent — Unit Tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ReviewerAgent } from './ReviewerAgent.js';
import type { ILLMGateway, LLMResponse } from '../../src/core/llm/LLMGateway.types.js';
import type { Artifact } from '../../core/orchestrator.types.js';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const PASS_REVIEW = JSON.stringify({
  violations: [],
  passed: true,
  summary: 'Code is clean and follows all rules.',
});

const FAIL_REVIEW = JSON.stringify({
  violations: [
    { severity: 'critical', file: 'src/auth.ts', line: 10, rule: 'NEXUS-001', message: 'Implicit any', suggestion: 'Add type annotation' },
  ],
  passed: false,
  summary: 'Critical type safety issue found.',
});

function makeGateway(content = PASS_REVIEW): ILLMGateway {
  return {
    complete: vi.fn().mockResolvedValue({
      content,
      model: 'claude-sonnet-4-6',
      usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
      stopReason: 'end_turn',
    } satisfies LLMResponse),
    stream: vi.fn(),
    registerTools: vi.fn(),
  };
}

const ARTIFACT: Artifact = {
  type: 'code', path: 'src/auth.ts',
  content: 'export class AuthService { login() { return true; } }',
};

const LONG_ARTIFACT: Artifact = {
  type: 'code', path: 'src/big.ts',
  content: Array.from({ length: 160 }, (_, i) => `// line ${i}`).join('\n'),
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('ReviewerAgent.review — no artifacts', () => {
  it('returns passed:true with empty violations', async () => {
    const agent = new ReviewerAgent(makeGateway());
    const result = await agent.review('task-1', []);
    expect(result.passed).toBe(true);
    expect(result.violations).toHaveLength(0);
  });
});

describe('ReviewerAgent.review — passing code', () => {
  let agent: ReviewerAgent;
  beforeEach(() => { agent = new ReviewerAgent(makeGateway(PASS_REVIEW)); });

  it('passed is true', async () => {
    const result = await agent.review('task-1', [ARTIFACT]);
    expect(result.passed).toBe(true);
  });

  it('violations array is empty', async () => {
    const result = await agent.review('task-1', [ARTIFACT]);
    expect(result.violations).toHaveLength(0);
  });

  it('summary is included', async () => {
    const result = await agent.review('task-1', [ARTIFACT]);
    expect(result.summary).toContain('clean');
  });
});

describe('ReviewerAgent.review — failing code', () => {
  it('passed is false when critical violation found', async () => {
    const agent = new ReviewerAgent(makeGateway(FAIL_REVIEW));
    const result = await agent.review('task-1', [ARTIFACT]);
    expect(result.passed).toBe(false);
  });

  it('violations contain the critical entry', async () => {
    const agent = new ReviewerAgent(makeGateway(FAIL_REVIEW));
    const result = await agent.review('task-1', [ARTIFACT]);
    expect(result.violations[0]?.rule).toBe('NEXUS-001');
    expect(result.violations[0]?.severity).toBe('critical');
  });
});

describe('ReviewerAgent.review — static checks', () => {
  it('adds NEXUS-005 violation for file over 150 lines', async () => {
    const agent = new ReviewerAgent(makeGateway(PASS_REVIEW));
    const result = await agent.review('task-1', [LONG_ARTIFACT]);
    const nexus005 = result.violations.find((v) => v.rule === 'NEXUS-005');
    expect(nexus005).toBeDefined();
    expect(nexus005?.severity).toBe('warning');
  });

  it('static violations combined with LLM violations', async () => {
    const agent = new ReviewerAgent(makeGateway(FAIL_REVIEW));
    const result = await agent.review('task-1', [LONG_ARTIFACT]);
    expect(result.violations.length).toBeGreaterThanOrEqual(2);
  });
});

describe('ReviewerAgent.review — malformed LLM response', () => {
  it('returns passed:true and empty violations on parse error', async () => {
    const agent = new ReviewerAgent(makeGateway('not json'));
    const result = await agent.review('task-1', [ARTIFACT]);
    expect(result.passed).toBe(true);
    expect(result.violations).toHaveLength(0);
  });
});
