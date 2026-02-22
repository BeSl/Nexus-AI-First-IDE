/**
 * NexusAgentFactory — Dependency Injection Assembly Root
 *
 * Constructs the full agent graph for production use:
 *   GatewayFactory → AgentToolkit → Agent personas
 *
 * Provider is selected via NEXUS_LLM_PROVIDER env (default: anthropic).
 * Each call to create() returns fresh agent instances.
 *
 * @security Never accepts secrets as parameters — env only.
 */

import { createGateway } from './llm/GatewayFactory.js';
import type { LlmProvider } from './llm/GatewayFactory.js';
import { AgentToolkit } from './llm/AgentToolkit.js';
import { ContextEngine } from './context/ContextEngine.js';
import { TFIDFVectorIndex } from './context/VectorIndex.js';
import { SkeletonProvider } from './context/SkeletonProvider.js';
import { NodeFileReader, collectTsFiles } from './context/NodeFileReader.js';
import { TypeScriptService } from './lsp/TypeScriptService.js';
import { LspToolProvider } from './lsp/LspToolProvider.js';
import { ArchitectAgent } from '../../agents/architect/ArchitectAgent.js';
import { CoderAgent } from '../../agents/coder/CoderAgent.js';
import { ReviewerAgent } from '../../agents/reviewer/ReviewerAgent.js';
import { TesterAgent } from '../../agents/tester/TesterAgent.js';
import type { IArchitectAgent } from '../../agents/architect/architect.types.js';
import type { ICoderAgent } from '../../agents/coder/coder.types.js';
import type { IReviewerAgent } from '../../agents/reviewer/reviewer.types.js';
import type { ITesterAgent } from '../../agents/tester/tester.types.js';

export interface NexusAgentsOptions {
  /** Override LLM provider (default: NEXUS_LLM_PROVIDER env, fallback 'anthropic') */
  readonly provider?: LlmProvider;
  /** Anthropic API key override (default: ANTHROPIC_API_KEY env) */
  readonly anthropicApiKey?: string;
  /** Google Gemini API key override (default: GEMINI_API_KEY env) */
  readonly geminiApiKey?: string;
  /** Ollama base URL override (default: OLLAMA_BASE_URL env) */
  readonly ollamaBaseUrl?: string;
  /** Model name override (default: provider's built-in default) */
  readonly model?: string;
}

export interface NexusAgents {
  readonly architect: IArchitectAgent;
  readonly coder: ICoderAgent;
  readonly reviewer: IReviewerAgent;
  readonly tester: ITesterAgent;
  /** Pre-index a directory into ContextEngine for richer agent context */
  indexProject(dir: string): Promise<void>;
}

export function createNexusAgents(opts: NexusAgentsOptions = {}): NexusAgents {
  const reader     = new NodeFileReader();
  const vectorIdx  = new TFIDFVectorIndex();
  const skeleton   = new SkeletonProvider();
  const ctx        = new ContextEngine(reader);

  // Each agent needing tools gets its own gateway (registerTools is stateful)
  const mkGateway  = () => createGateway({
    ...(opts.provider        ? { provider: opts.provider }               : {}),
    ...(opts.anthropicApiKey ? { anthropicApiKey: opts.anthropicApiKey } : {}),
    ...(opts.geminiApiKey    ? { geminiApiKey: opts.geminiApiKey }       : {}),
    ...(opts.ollamaBaseUrl   ? { ollamaBaseUrl: opts.ollamaBaseUrl }     : {}),
    ...(opts.model           ? { model: opts.model }                     : {}),
  });
  const lspToolProvider = new LspToolProvider(new TypeScriptService());
  const toolkit    = new AgentToolkit(ctx, vectorIdx, skeleton, [lspToolProvider]);

  return {
    architect: new ArchitectAgent(mkGateway(), toolkit),
    coder:     new CoderAgent(mkGateway(), toolkit),
    reviewer:  new ReviewerAgent(mkGateway()),
    tester:    new TesterAgent(mkGateway()),

    async indexProject(dir: string): Promise<void> {
      const files = await collectTsFiles(dir);
      await ctx.index(files);
      for (const f of files) {
        const content = await reader.read(f);
        await vectorIdx.upsert(f, f, content);
      }
    },
  };
}
