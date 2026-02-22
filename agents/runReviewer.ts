/**
 * runReviewer — XState fromPromise actor
 *
 * Adapts ReviewerAgent into the XState actor interface.
 * Reviews code artifacts from the Coder and returns violations.
 * The machine routes to 'failed' if critical violations are found.
 *
 * @security Read-only. No file writes.
 */

import { fromPromise } from 'xstate';
import { createNexusAgents } from '../src/core/NexusAgentFactory.js';
import type { AgentResult, AgentRole, Artifact } from "../core/orchestrator.types.js";

interface ReviewerActorInput {
  readonly taskId: string;
  readonly intent: string;
  readonly artifacts: readonly Artifact[];
  readonly role: AgentRole;
}

export const runReviewer = fromPromise<AgentResult, ReviewerActorInput>(
  async ({ input }) => {
    const start = Date.now();
    const agents = createNexusAgents();

    const codeArtifacts = input.artifacts.filter(
      (a) => a.type === 'code' || a.type === 'file',
    );

    const result = await agents.reviewer.review(input.taskId, codeArtifacts);

    if (!result.passed) {
      const critical = result.violations
        .filter((v) => v.severity === 'critical')
        .map((v) => `[${v.rule}] ${v.file}:${v.line} — ${v.message}`)
        .join('\n');
      throw new Error(`Review failed — critical violations:\n${critical}`);
    }

    return {
      taskId: input.taskId,
      agentId: 'reviewer-v1' as ReturnType<() => import('../core/orchestrator.types.js').AgentId>,
      output: result,
      artifacts: [],   // reviewer produces no new artifacts
      duration: Date.now() - start,
    };
  },
);
