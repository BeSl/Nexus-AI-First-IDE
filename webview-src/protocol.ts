/**
 * Webview Protocol — minimal message types for the React webview bundle.
 *
 * Mirrors src/ui/webview.types.ts but dependency-free (no Node.js imports),
 * so esbuild can bundle this for the browser without issues.
 *
 * @security Messages are read-only data — no eval, no dynamic code.
 */

export type AgentRole = 'architect' | 'coder' | 'reviewer' | 'tester';
export type AgentProgressStatus = 'pending' | 'active' | 'done' | 'failed';

export interface AgentProgress {
  readonly role: AgentRole;
  readonly status: AgentProgressStatus;
  readonly durationMs?: number;
  readonly artifactCount?: number;
}

export interface NexusState {
  readonly currentState: string;
  readonly activeRole: AgentRole | null;
  readonly taskId: string | null;
  readonly status: string;
  readonly progress: readonly AgentProgress[];
}

export interface OrchestratorStateMessage {
  readonly type: 'orchestrator:state';
  readonly state: NexusState;
}

export interface BuildResultMessage {
  readonly type: 'build:result';
  readonly taskId: string;
  readonly success: boolean;
  readonly errorCount: number;
  readonly feedback: string;
}

export type ExtensionMessage =
  | OrchestratorStateMessage
  | BuildResultMessage
  | { readonly type: string };

export interface CancelMessage {
  readonly type: 'user:cancel';
  readonly taskId: string;
}
