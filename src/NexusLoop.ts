/**
 * NexusLoop — Nexus Agent Orchestration Wiring
 *
 * Creates an XState actor from orchestratorMachine with real agent runners,
 * bridges state transitions to the graph panel, and handles user approval flow.
 *
 * @security All agent outputs are treated as untrusted until VFS.confirm().
 *           User approval is required before any real FS write.
 */

import * as vscode from 'vscode';
import { createActor, type Actor } from 'xstate';
import { orchestratorMachine, type OrchestratorContext } from '../core/orchestrator.machine.js';
import { runArchitect } from '../agents/runArchitect.js';
import { runCoder } from '../agents/runCoder.js';
import { runShadowBuild } from '../agents/runShadowBuild.js';
import { runReviewer } from '../agents/runReviewer.js';
import { runTester } from '../agents/runTester.js';
import { WorkspaceCommitter, nodeWorkspaceFs } from './core/vfs/WorkspaceCommitter.js';
import { NexusGraphPanel } from '../ui/NexusGraphPanel.js';
import { NexusApprovalPanel } from '../ui/NexusApprovalPanel.js';
import type { AgentProgress } from './ui/webview.types.js';
import type { AgentRole, Artifact, TaskStatus } from '../core/orchestrator.types.js';

type OrchestratorActor = Actor<typeof orchestratorMachine>;

/** Maps XState context to OrchestratorBridge progress array */
function buildProgress(ctx: OrchestratorContext, currentState: string): readonly AgentProgress[] {
  const order: AgentRole[] = ['architect', 'coder', 'reviewer', 'tester'];
  const completedCount = order.indexOf(ctx.currentRole ?? 'architect');
  return order.map((role, i) => ({
    role,
    status:
      currentState === 'done' ? 'done'
      : i < completedCount ? 'done'
      : role === ctx.currentRole ? 'active'
      : 'pending',
  }));
}

/** Derive TaskStatus from XState state name */
function toTaskStatus(state: string): TaskStatus {
  if (state === 'done') return 'completed';
  if (state === 'failed') return 'failed';
  if (state === 'cancelled') return 'cancelled';
  if (state === 'idle') return 'pending';
  return 'running';
}

export class NexusLoop {
  readonly #panel: NexusGraphPanel;
  readonly #extensionUri: vscode.Uri;
  #actor: OrchestratorActor | null = null;
  #stopped = false;

  constructor(panel: NexusGraphPanel, extensionUri: vscode.Uri) {
    this.#panel = panel;
    this.#extensionUri = extensionUri;
  }

  start(intent: string): void {
    const taskId = `nexus-${Date.now()}`;
    const machine = orchestratorMachine.provide({
      actors: { runArchitect, runCoder, runShadowBuild, runReviewer, runTester },
    });

    this.#actor = createActor(machine, { input: { taskId, intent } });

    this.#actor.subscribe((snapshot) => {
      if (this.#stopped) return;
      const stateName = typeof snapshot.value === 'string' ? snapshot.value : 'unknown';
      const ctx = snapshot.context;

      // Forward to React Flow graph via OrchestratorBridge
      this.#panel.bridge.onStateChange(
        {
          value: stateName,
          context: {
            ...(ctx.currentRole != null ? { activeRole: ctx.currentRole } : {}),
            currentTaskId: ctx.taskId,
            status: toTaskStatus(stateName),
          },
        },
        buildProgress(ctx, stateName),
      );

      // Show approval panel when architect finishes
      if (stateName === 'awaitingApproval') {
        const artifacts: readonly Artifact[] = ctx.artifacts;
        NexusApprovalPanel.createOrShow(this.#extensionUri, artifacts, (approved) => {
          if (this.#stopped) return;
          this.#actor?.send(approved ? { type: 'USER_APPROVED' } : { type: 'USER_REJECTED' });
        });
      }

      if (stateName === 'done') {
        void this.#onDone(ctx);
      }

      if (stateName === 'failed') {
        void vscode.window.showErrorMessage(`Nexus Loop failed: ${ctx.error ?? 'Unknown error'}`);
      }
    });

    // Relay cancel from webview to actor
    this.#panel.onMessage((msg) => {
      if (msg.type === 'user:cancel') this.#actor?.send({ type: 'CANCEL' });
    });

    this.#actor.start();
    this.#actor.send({ type: 'START', intent });
  }

  /** Prompt user to commit generated artifacts to workspace */
  async #onDone(ctx: OrchestratorContext): Promise<void> {
    const fileArtifacts = ctx.artifacts.filter((a) => a.type === 'file' || a.type === 'code');
    if (fileArtifacts.length === 0) {
      void vscode.window.showInformationMessage('Nexus Loop complete — no file artifacts to write.');
      return;
    }

    const paths = fileArtifacts.map((a) => a.path);
    const choice = await vscode.window.showQuickPick(paths, {
      title: `Nexus: Write ${fileArtifacts.length} file(s) to workspace?`,
      canPickMany: true,
      placeHolder: 'Select files to write (press Escape to skip)',
    });

    if (!choice || choice.length === 0) return;

    const selected = fileArtifacts.filter((a) => choice.includes(a.path));
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? process.cwd();
    const committer = new WorkspaceCommitter(nodeWorkspaceFs);
    const result = await committer.commit(ctx.taskId, selected, workspaceRoot);

    void vscode.window.showInformationMessage(
      `Nexus: wrote ${result.written.length} file(s) to workspace.`,
    );
  }

  stop(): void {
    this.#stopped = true;
    this.#actor?.stop();
  }
}
