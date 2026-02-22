/**
 * NexusAgentFactory — Dependency Injection Assembly Root
 *
 * Constructs the full agent graph for production use:
 *   AnthropicGateway → AgentToolkit → Agent personas
 *
 * Each call to create() returns fresh agent instances.
 * API key is read from ANTHROPIC_API_KEY env variable.
 *
 * @security Never accepts secrets as parameters — env only.
 */

import { AnthropicGateway } from './llm/AnthropicGateway.js';
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

export interface NexusAgents {
  readonly architect: IArchitectAgent;
  readonly coder: ICoderAgent;
  readonly reviewer: IReviewerAgent;
  readonly tester: ITesterAgent;
  /** Pre-index a directory into ContextEngine for richer agent context */
  indexProject(dir: string): Promise<void>;
}

export function createNexusAgents(apiKey?: string): NexusAgents {
  const reader     = new NodeFileReader();
  const vectorIdx  = new TFIDFVectorIndex();
  const skeleton   = new SkeletonProvider();
  const ctx        = new ContextEngine(reader);

  // Each agent needing tools gets its own gateway (registerTools is stateful)
  const mkGateway  = () => new AnthropicGateway(apiKey ? { apiKey } : {});
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
