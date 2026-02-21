/**
 * CoderAgent — Unit Tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CoderAgent } from './CoderAgent.js';
import type { ILLMGateway, LLMResponse } from '../../src/core/llm/LLMGateway.types.js';
import type { IAgentToolkit } from '../../src/core/llm/AgentToolkit.types.js';
import type { ArchitectOutput } from '../architect/architect.types.js';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const FILE_SPECS = JSON.stringify([
  { path: 'src/auth/AuthService.ts', content: 'export class AuthService implements IAuthService { login() {} }' },
]);

function makeGateway(content = FILE_SPECS): ILLMGateway {
  return {
    complete: vi.fn().mockResolvedValue({
      content,
      model: 'claude-sonnet-4-6',
      usage: { inputTokens: 200, outputTokens: 400, totalTokens: 600 },
      stopReason: 'end_turn',
    } satisfies LLMResponse),
    stream: vi.fn(),
    registerTools: vi.fn(),
  };
}

function makeToolkit(): IAgentToolkit {
  return {
    getTools: vi.fn().mockReturnValue([{ name: 'context_query', description: '', inputSchema: {} }]),
    dispatch: vi.fn(),
  };
}

const ARCH_OUTPUT: ArchitectOutput = {
  agentId: 'architect-v1' as ReturnType<() => import('../../core/orchestrator.types.js').AgentId>,
  intent: {
    raw: 'Add auth',
    summary: 'JWT auth module',
    modules: [{ name: 'AuthService', path: 'src/auth/AuthService.ts', role: 'core', interfaces: [], dependsOn: [] }],
    dependencies: [],
  },
  artifacts: [{ type: 'file', path: 'src/auth/AuthService.ts', content: 'export interface IAuthService { login(): void; }' }],
};

const BASE_INPUT = { architectOutput: ARCH_OUTPUT, retryCount: 0 };

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('CoderAgent constructor', () => {
  it('registers toolkit tools on gateway', () => {
    const gw = makeGateway();
    new CoderAgent(gw, makeToolkit());
    expect(gw.registerTools).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ name: 'context_query' })]),
    );
  });
});

describe('CoderAgent.implement — happy path', () => {
  let agent: CoderAgent;
  beforeEach(() => { agent = new CoderAgent(makeGateway(), makeToolkit()); });

  it('returns artifacts with type "code"', async () => {
    const result = await agent.implement(BASE_INPUT);
    expect(result.artifacts[0]?.type).toBe('code');
  });

  it('artifact path matches LLM output', async () => {
    const result = await agent.implement(BASE_INPUT);
    expect(result.artifacts[0]?.path).toBe('src/auth/AuthService.ts');
  });

  it('retryCount is preserved in output', async () => {
    const result = await agent.implement({ ...BASE_INPUT, retryCount: 2, buildFeedback: 'errors...' });
    expect(result.retryCount).toBe(2);
  });

  it('confident is true on first attempt', async () => {
    const result = await agent.implement(BASE_INPUT);
    expect(result.confident).toBe(true);
  });
});

describe('CoderAgent.implement — retry with build feedback', () => {
  it('includes buildFeedback in user prompt', async () => {
    const gw = makeGateway();
    const agent = new CoderAgent(gw, makeToolkit());
    await agent.implement({ ...BASE_INPUT, retryCount: 1, buildFeedback: 'TS2345 error at line 5' });
    const msg = (gw.complete as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
    expect(msg[0]?.content).toContain('TS2345 error at line 5');
  });

  it('uses CODER_RETRY_PROMPT as system on retry', async () => {
    const gw = makeGateway();
    const agent = new CoderAgent(gw, makeToolkit());
    await agent.implement({ ...BASE_INPUT, retryCount: 1, buildFeedback: 'err' });
    const opts = (gw.complete as ReturnType<typeof vi.fn>).mock.calls[0]?.[1];
    expect(opts?.system).toContain('Fix ONLY the reported errors');
  });
});

describe('CoderAgent.implement — malformed LLM response', () => {
  it('returns empty artifacts on invalid JSON', async () => {
    const agent = new CoderAgent(makeGateway('not json at all'), makeToolkit());
    const result = await agent.implement(BASE_INPUT);
    expect(result.artifacts).toHaveLength(0);
  });

  it('strips markdown code fences', async () => {
    const gw = makeGateway(`\`\`\`json\n${FILE_SPECS}\n\`\`\``);
    const agent = new CoderAgent(gw, makeToolkit());
    const result = await agent.implement(BASE_INPUT);
    expect(result.artifacts).toHaveLength(1);
  });
});
