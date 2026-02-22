/**
 * runShadowBuild — XState fromPromise actor
 *
 * Runs an in-process TypeScript type-check over the Coder's output artifacts
 * BEFORE the Reviewer sees them. Uses TypeScriptService.getDiagnostics() with
 * sourceOverride so no files touch the real filesystem.
 *
 * On success: returns AgentResult (machine proceeds to reviewer).
 * On failure: throws — machine retries coder up to MAX_RETRIES times.
 *
 * @security Pure in-memory check. No shell processes. No disk writes.
 */

import { fromPromise } from 'xstate';
import { TypeScriptService } from '../src/core/lsp/TypeScriptService.js';
import type { AgentResult, AgentRole, Artifact } from '../core/orchestrator.types.js';

interface ShadowBuildActorInput {
  readonly taskId: string;
  readonly intent: string;
  readonly artifacts: readonly Artifact[];
  readonly role: AgentRole;
}

export const runShadowBuild = fromPromise<AgentResult, ShadowBuildActorInput>(
  async ({ input }) => {
    const start = Date.now();
    const ts = new TypeScriptService();

    const fileArtifacts = input.artifacts.filter(
      (a) => (a.type === 'file' || a.type === 'code') && a.path.endsWith('.ts'),
    );

    type DiagEntry = { filePath: string; line: number; message: string };
    const errors: DiagEntry[] = [];

    for (const artifact of fileArtifacts) {
      const diags = ts.getDiagnostics(artifact.path, artifact.content);
      for (const d of diags) {
        if (d.category === 'error') {
          errors.push({ filePath: d.filePath, line: d.line, message: d.message });
        }
      }
    }

    if (errors.length > 0) {
      const feedback = errors
        .map((e) => `${e.filePath}:${e.line} — ${e.message}`)
        .join('\n');
      throw new Error(`Shadow build failed (${errors.length} error(s)):\n${feedback}`);
    }

    return {
      taskId: input.taskId,
      agentId: 'shadow-build-v1' as ReturnType<() => import('../core/orchestrator.types.js').AgentId>,
      output: { passed: true, checkedFiles: fileArtifacts.length },
      artifacts: [],
      duration: Date.now() - start,
    };
  },
);
