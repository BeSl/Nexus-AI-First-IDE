/**
 * Webview — Message Protocol Types
 *
 * Defines the VS Code ↔ Webview message contract.
 * Extension sends StateMessage/DiffMessage to Webview.
 * Webview sends CommandMessage back to extension.
 *
 * All messages are discriminated unions (type field) — safe to switch on.
 * @security Never include secrets or raw file content in webview messages.
 */

import type { AgentRole, TaskStatus } from '../../core/orchestrator.types.js';

// ── Extension → Webview ───────────────────────────────────────────────────────

/** Orchestrator state snapshot for the graph visualization */
export interface OrchestratorStateMessage {
  readonly type: 'orchestrator:state';
  readonly state: NexusState;
}

export interface NexusState {
  readonly currentState: string;         // XState node name
  readonly activeRole: AgentRole | null;
  readonly taskId: string | null;
  readonly status: TaskStatus;
  readonly progress: readonly AgentProgress[];
}

export interface AgentProgress {
  readonly role: AgentRole;
  readonly status: 'pending' | 'active' | 'done' | 'failed';
  readonly durationMs?: number;
  readonly artifactCount?: number;
}

/** Diff view — show staged VFS changes for user approval */
export interface DiffMessage {
  readonly type: 'diff:show';
  readonly taskId: string;
  readonly files: readonly FileDiff[];
}

export interface FileDiff {
  readonly path: string;
  readonly before: string;   // original content (empty string = new file)
  readonly after: string;    // staged content
  readonly lintViolations: readonly LintViolationSummary[];
}

export interface LintViolationSummary {
  readonly rule: string;
  readonly severity: 'critical' | 'warning' | 'info';
  readonly line: number;
  readonly message: string;
}

/** Build feedback panel */
export interface BuildResultMessage {
  readonly type: 'build:result';
  readonly taskId: string;
  readonly success: boolean;
  readonly errorCount: number;
  readonly durationMs: number;
  readonly feedback: string;   // BuildFeedback.format() output
}

export type ExtensionToWebviewMessage =
  | OrchestratorStateMessage
  | DiffMessage
  | BuildResultMessage;

// ── Webview → Extension ───────────────────────────────────────────────────────

/** User approved the staged diff */
export interface ApproveMessage {
  readonly type: 'user:approve';
  readonly taskId: string;
}

/** User rejected the staged diff */
export interface RejectMessage {
  readonly type: 'user:reject';
  readonly taskId: string;
  readonly reason?: string;
}

/** User cancelled the active task */
export interface CancelMessage {
  readonly type: 'user:cancel';
  readonly taskId: string;
}

export type WebviewToExtensionMessage =
  | ApproveMessage
  | RejectMessage
  | CancelMessage;
