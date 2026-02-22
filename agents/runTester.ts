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
import type { NexusAgentsOptions } from '../src/core/NexusAgentFactory.js';
import type { AgentResult, AgentRole, Artifact } from '../core/orchestrator.types.js';

interface TesterActorInput {
  readonly taskId: string;
  readonly intent: string;
  readonly artifacts: readonly Artifact[];
  readonly role: AgentRole;
}

/** Factory: create a runTester actor bound to the given gateway options. */
export function createRunTester(opts: NexusAgentsOptions = {}) {
  return fromPromise<AgentResult, TesterActorInput>(async ({ input }) => {
    const start = Date.now();
    const agents = createNexusAgents(opts);

    const output = await agents.tester.generateTests(input.taskId, input.artifacts);

    return {
      taskId: input.taskId,
      agentId: 'tester-v1' as ReturnType<() => import('../core/orchestrator.types.js').AgentId>,
      output,
      artifacts: output.artifacts,
      duration: Date.now() - start,
    };
  });
}

/** Default actor (reads from env variables). Used in tests and legacy wiring. */
export const runTester = createRunTester();
