/**
 * runCoder — XState fromPromise actor
 *
 * Adapts CoderAgent into the XState actor interface.
 * Receives ArchitectOutput artifacts from context and generates implementations.
 * On retry (buildFeedback in context), passes errors to agent for self-correction.
 *
 * @security Agent output stays in VFS until user calls confirm().
 */

import { fromPromise } from 'xstate';
import { createNexusAgents } from '../src/core/NexusAgentFactory.js';
import type { AgentResult, Artifact } from '../core/orchestrator.types.js';
import type { ArchitectOutput } from './architect/architect.types.js';

interface CoderActorInput {
  readonly taskId: string;
  readonly intent: string;
  readonly artifacts: readonly Artifact[];
  /** BuildFeedback.format() output from previous failed shadow build */
  readonly buildFeedback?: string;
  readonly retryCount?: number;
}

export const runCoder = fromPromise<AgentResult, CoderActorInput>(
  async ({ input }) => {
    const start = Date.now();
    const agents = createNexusAgents();

    // Reconstruct ArchitectOutput from artifacts in context
    const architectOutput: ArchitectOutput = {
      agentId: 'architect-v1' as ReturnType<() => import('../core/orchestrator.types.js').AgentId>,
      intent: {
        raw: input.intent,
        summary: input.intent,
        modules: [],
        dependencies: [],
      },
      artifacts: input.artifacts.filter((a) => a.type === 'file'),
    };

    const output = await agents.coder.implement({
      architectOutput,
      buildFeedback: input.buildFeedback,
      retryCount: input.retryCount ?? 0,
    });

    return {
      taskId: input.taskId,
      agentId: 'coder-v1' as ReturnType<() => import('../core/orchestrator.types.js').AgentId>,
      output,
      artifacts: output.artifacts,
      duration: Date.now() - start,
    };
  },
);
