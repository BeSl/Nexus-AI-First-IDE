/**
 * runArchitect — XState fromPromise actor
 *
 * Adapts ArchitectAgent into the XState actor interface expected
 * by orchestratorMachine. Injected via machine.provide().
 *
 * @security Never reads ANTHROPIC_API_KEY directly — delegates to NexusAgentFactory.
 */

import { fromPromise } from 'xstate';
import { createNexusAgents } from '../src/core/NexusAgentFactory.js';
import type { NexusAgentsOptions } from '../src/core/NexusAgentFactory.js';
import type { AgentResult, AgentRole, Artifact } from '../core/orchestrator.types.js';

interface ArchitectActorInput {
  readonly taskId: string;
  readonly intent: string;
  readonly artifacts: readonly Artifact[];
  readonly role: AgentRole;
}

/** Factory: create a runArchitect actor bound to the given gateway options. */
export function createRunArchitect(opts: NexusAgentsOptions = {}) {
  return fromPromise<AgentResult, ArchitectActorInput>(async ({ input }) => {
    const start = Date.now();
    const agents = createNexusAgents(opts);

    const parsedIntent = await agents.architect.parseIntent(input.intent);
    const output = await agents.architect.designModules(parsedIntent);

    return {
      taskId: input.taskId,
      agentId: output.agentId,
      output,
      artifacts: output.artifacts,
      duration: Date.now() - start,
    };
  });
}

/** Default actor (reads from env variables). Used in tests and legacy wiring. */
export const runArchitect = createRunArchitect();
