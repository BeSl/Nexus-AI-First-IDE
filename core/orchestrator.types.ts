/**
 * Core Orchestrator — Type Contracts
 * @security All agent communications must be validated through these types
 */

import type { z } from 'zod';

/** Unique identifier for any agent instance */
export type AgentId = string & { readonly __brand: 'AgentId' };

/** Supported agent personas in the Nexus system */
export type AgentRole = 'architect' | 'coder' | 'reviewer' | 'tester';

/** Lifecycle states of an agent task */
export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

/** A discrete unit of work dispatched to an agent */
export interface AgentTask {
  readonly id: string;
  readonly agentId: AgentId;
  readonly role: AgentRole;
  readonly intent: string;
  readonly context: Readonly<Record<string, unknown>>;
  readonly status: TaskStatus;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/** Result produced by an agent after completing a task */
export interface AgentResult {
  readonly taskId: string;
  readonly agentId: AgentId;
  readonly output: unknown;
  readonly artifacts: readonly Artifact[];
  readonly duration: number;
}

/** A file or data artifact produced by an agent */
export interface Artifact {
  readonly type: 'file' | 'code' | 'test' | 'schema';
  readonly path: string;
  readonly content: string;
}

/** The Orchestrator manages agent lifecycle and task routing */
export interface IOrchestratorService {
  dispatch(intent: string, context?: Record<string, unknown>): Promise<AgentResult>;
  getTask(taskId: string): Promise<AgentTask | null>;
  cancelTask(taskId: string): Promise<void>;
}
