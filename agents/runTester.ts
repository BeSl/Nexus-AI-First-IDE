/**
 * runTester — XState fromPromise actor
 *
 * Adapts TesterAgent into the XState actor interface.
 * Generates Vitest test files for all code artifacts.
 * Test artifacts are written to VFS alongside code artifacts.
 *
 * @security Test files do not touch real FS — written via VFS.
 */

import { fromPromise } from 'xstate';
import { createNexusAgents } from '../src/core/NexusAgentFactory.js';
import type { AgentResult, Artifact } from '../core/orchestrator.types.js';

interface TesterActorInput {
  readonly taskId: string;
  readonly intent: string;
  readonly artifacts: readonly Artifact[];
}

export const runTester = fromPromise<AgentResult, TesterActorInput>(
  async ({ input }) => {
    const start = Date.now();
    const agents = createNexusAgents();

    const output = await agents.tester.generateTests(input.taskId, input.artifacts);

    return {
      taskId: input.taskId,
      agentId: 'tester-v1' as ReturnType<() => import('../core/orchestrator.types.js').AgentId>,
      output,
      artifacts: output.artifacts,
      duration: Date.now() - start,
    };
  },
);
