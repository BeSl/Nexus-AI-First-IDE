/**
 * OrchestratorBridge — XState → Webview Event Adapter
 *
 * Subscribes to Orchestrator state transitions and converts them
 * into ExtensionToWebviewMessage objects for the VS Code Webview panel.
 *
 * Usage (in VS Code Extension activate()):
 *   const bridge = new OrchestratorBridge(orchestratorActor, panel.webview);
 *   bridge.start();
 *   // On deactivate:
 *   bridge.stop();
 *
 * @security Never forwards raw file content — only metadata and diffs.
 */

import type {
  ExtensionToWebviewMessage,
  OrchestratorStateMessage,
  BuildResultMessage,
  DiffMessage,
  NexusState,
  AgentProgress,
} from './webview.types.js';
import type { AgentRole, TaskStatus } from '../../core/orchestrator.types.js';
import type { BuildResult } from '../core/builder/BuildOrchestrator.types.js';
import { BuildFeedback } from '../core/builder/BuildFeedback.js';

/** Minimal VS Code webview postMessage interface (injectable for tests) */
export interface IWebviewSender {
  postMessage(message: ExtensionToWebviewMessage): Thenable<boolean> | void;
}

/** XState actor snapshot shape (minimal subset used here) */
export interface IOrchestratorSnapshot {
  readonly value: string | Record<string, unknown>;
  readonly context: {
    readonly activeRole?: AgentRole;
    readonly currentTaskId?: string;
    readonly status?: TaskStatus;
  };
}

export class OrchestratorBridge {
  readonly #webview: IWebviewSender;
  #running = false;
  #lastState: string | null = null;

  constructor(webview: IWebviewSender) {
    this.#webview = webview;
  }

  start(): void { this.#running = true; }
  stop(): void  { this.#running = false; }
  get isRunning(): boolean { return this.#running; }

  /**
   * Called when the orchestrator XState actor emits a new snapshot.
   * Converts to OrchestratorStateMessage and sends to webview.
   */
  onStateChange(snapshot: IOrchestratorSnapshot, progress: readonly AgentProgress[]): void {
    if (!this.#running) return;
    const stateName = resolveStateName(snapshot.value);
    if (stateName === this.#lastState) return; // deduplicate
    this.#lastState = stateName;

    const msg: OrchestratorStateMessage = {
      type: 'orchestrator:state',
      state: {
        currentState: stateName,
        activeRole: snapshot.context.activeRole ?? null,
        taskId: snapshot.context.currentTaskId ?? null,
        status: snapshot.context.status ?? 'pending',
        progress,
      } satisfies NexusState,
    };
    this.#webview.postMessage(msg);
  }

  /** Send build result to the feedback panel in Webview */
  onBuildResult(result: BuildResult): void {
    if (!this.#running) return;
    const msg: BuildResultMessage = {
      type: 'build:result',
      taskId: result.taskId,
      success: result.success,
      errorCount: result.errors.length,
      durationMs: result.durationMs,
      feedback: result.success ? '' : BuildFeedback.format(result),
    };
    this.#webview.postMessage(msg);
  }

  /** Send diff for user approval */
  onDiffReady(diff: DiffMessage): void {
    if (!this.#running) return;
    this.#webview.postMessage(diff);
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function resolveStateName(value: string | Record<string, unknown>): string {
  if (typeof value === 'string') return value;
  const keys = Object.keys(value);
  return keys.length > 0 ? keys[0]! : 'unknown';
}
