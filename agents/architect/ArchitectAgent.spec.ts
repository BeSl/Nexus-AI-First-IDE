/**
 * ArchitectAgent — Unit Tests
 * ILLMGateway and IAgentToolkit are fully mocked.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ArchitectAgent } from './ArchitectAgent.js';
import type { ILLMGateway, LLMResponse } from '../../src/core/llm/LLMGateway.types.js';
import type { IAgentToolkit } from '../../src/core/llm/AgentToolkit.types.js';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const VALID_INTENT_JSON = JSON.stringify({
  raw: 'Add user authentication',
  summary: 'Implement JWT-based user authentication module',
  modules: [
    {
      name: 'AuthService',
      path: 'src/auth/AuthService.ts',
      role: 'core',
      interfaces: [
        {
          name: 'IAuthService',
          fields: [
            { name: 'login', type: '(user: string, pass: string) => Promise<string>', readonly: true, optional: false },
            { name: 'logout', type: '(token: string) => Promise<void>', readonly: true, optional: false },
          ],
        },
      ],
      dependsOn: [],
    },
  ],
  dependencies: ['jsonwebtoken'],
});

function makeGateway(responseContent = VALID_INTENT_JSON): ILLMGateway {
  return {
    complete: vi.fn().mockResolvedValue({
      content: responseContent,
      model: 'claude-sonnet-4-6',
      usage: { inputTokens: 100, outputTokens: 200, totalTokens: 300 },
      stopReason: 'end_turn',
    } satisfies LLMResponse),
    stream: vi.fn(),
    registerTools: vi.fn(),
  };
}

function makeToolkit(): IAgentToolkit {
  return {
    getTools: vi.fn().mockReturnValue([
      { name: 'context_query', description: 'query', inputSchema: {} },
    ]),
    dispatch: vi.fn(),
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('ArchitectAgent constructor', () => {
  it('registers toolkit tools on the gateway', () => {
    const gw = makeGateway();
    new ArchitectAgent(gw, makeToolkit());
    expect(gw.registerTools).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ name: 'context_query' })]),
    );
  });
});

describe('ArchitectAgent.parseIntent', () => {
  let agent: ArchitectAgent;
  beforeEach(() => { agent = new ArchitectAgent(makeGateway(), makeToolkit()); });

  it('returns ParsedIntent with summary', async () => {
    const result = await agent.parseIntent('Add user authentication');
    expect(result.summary).toBe('Implement JWT-based user authentication module');
  });

  it('returns modules array', async () => {
    const result = await agent.parseIntent('Add user authentication');
    expect(result.modules).toHaveLength(1);
    expect(result.modules[0]?.name).toBe('AuthService');
  });

  it('strips markdown code fences from LLM output', async () => {
    const gw = makeGateway(`\`\`\`json\n${VALID_INTENT_JSON}\n\`\`\``);
    const ag = new ArchitectAgent(gw, makeToolkit());
    const result = await ag.parseIntent('Add auth');
    expect(result.modules).toHaveLength(1);
  });

  it('uses ARCHITECT_SYSTEM_PROMPT as system message', async () => {
    const gw = makeGateway();
    const ag = new ArchitectAgent(gw, makeToolkit());
    await ag.parseIntent('x');
    const opts = (gw.complete as ReturnType<typeof vi.fn>).mock.calls[0]?.[1];
    expect(opts?.system).toContain('Architect agent');
  });
});

describe('ArchitectAgent.designModules', () => {
  it('returns ArchitectOutput with artifacts', async () => {
    const gw = makeGateway();
    const agent = new ArchitectAgent(gw, makeToolkit());
    const intent = await agent.parseIntent('Add auth');
    const output = await agent.designModules(intent);
    expect(output.agentId).toBe('architect-v1');
    expect(output.artifacts).toHaveLength(1);
  });

  it('artifact uri matches module path', async () => {
    const gw = makeGateway();
    const agent = new ArchitectAgent(gw, makeToolkit());
    const intent = await agent.parseIntent('Add auth');
    const output = await agent.designModules(intent);
    expect(output.artifacts[0]?.path).toBe('src/auth/AuthService.ts');
  });

  it('artifact content contains interface definition', async () => {
    const gw = makeGateway();
    const agent = new ArchitectAgent(gw, makeToolkit());
    const intent = await agent.parseIntent('Add auth');
    const output = await agent.designModules(intent);
    expect(output.artifacts[0]?.content).toContain('export interface IAuthService');
  });
});
