/**
 * Orchestrator Service — Implementation
 *
 * Wires the XState machine to real agent runners via Dependency Injection.
 * Agents are injected at construction — no hardcoded implementations here.
 *
 * @security Agent runners are sandboxed through IContextEngine + IVirtualFileSystem.
 *           Direct FS access is forbidden at this layer.
 */

import { createActor, fromPromise } from 'xstate';
import { randomUUID } from 'crypto';

import { orchestratorMachine } from './orchestrator.machine.js';
import type { IOrchestratorService, AgentTask, AgentResult } from './orchestrator.types.js';
import type { IContextEngine } from './context-engine.types.js';
import type { IVirtualFileSystem } from './vfs.types.js';

// ── Agent runner interface (injected, not hardcoded) ─────────────────────────

export interface IAgentRunner {
  run(input: {
    taskId: string;
    intent: string;
    context: IContextEngine;
    vfs: IVirtualFileSystem;
  }): Promise<AgentResult>;
}

export interface OrchestratorDeps {
  readonly contextEngine: IContextEngine;
  readonly vfs: IVirtualFileSystem;
  readonly agents: {
    readonly architect: IAgentRunner;
    readonly coder: IAgentRunner;
    readonly reviewer: IAgentRunner;
    readonly tester: IAgentRunner;
  };
}

// ── In-memory task store (replace with persistent store in prod) ──────────────

const tasks = new Map<string, AgentTask>();

// ── Implementation ────────────────────────────────────────────────────────────

export class OrchestratorService implements IOrchestratorService {
  readonly #deps: OrchestratorDeps;

  constructor(deps: OrchestratorDeps) {
    this.#deps = deps;
  }

  async dispatch(
    intent: string,
    ctx: Record<string, unknown> = {}
  ): Promise<AgentResult> {
    const taskId = randomUUID();
    const now = new Date();

    const task: AgentTask = {
      id: taskId,
      agentId: 'orchestrator' as import('./orchestrator.types.js').AgentId,
      role: 'architect',
      intent,
      context: ctx,
      status: 'running',
      createdAt: now,
      updatedAt: now,
    };
    tasks.set(taskId, task);

    return new Promise((resolve, reject) => {
      const { contextEngine, vfs, agents } = this.#deps;

      const makeActorInput = (taskId: string, intent: string) => ({
        taskId,
        intent,
        artifacts: [] as const,
        role: 'architect' as const,
      });

      const machine = orchestratorMachine.provide({
        actors: {
          runArchitect: fromPromise(({ input }) =>
            agents.architect.run({ taskId: input.taskId, intent: input.intent, context: contextEngine, vfs })
          ),
          runCoder: fromPromise(({ input }) =>
            agents.coder.run({ taskId: input.taskId, intent: input.intent, context: contextEngine, vfs })
          ),
          runReviewer: fromPromise(({ input }) =>
            agents.reviewer.run({ taskId: input.taskId, intent: input.intent, context: contextEngine, vfs })
          ),
          runTester: fromPromise(({ input }) =>
            agents.tester.run({ taskId: input.taskId, intent: input.intent, context: contextEngine, vfs })
          ),
        },
      });

      const actor = createActor(machine, { input: { taskId, intent } });

      actor.subscribe((state) => {
        const updatedTask = tasks.get(taskId);
        if (!updatedTask) return;

        if (state.matches('done')) {
          const lastResult = state.context.results.at(-1);
          if (!lastResult) {
            reject(new Error('No results produced'));
            return;
          }
          tasks.set(taskId, { ...updatedTask, status: 'completed', updatedAt: new Date() });
          resolve(lastResult);
        }

        if (state.matches('failed')) {
          tasks.set(taskId, { ...updatedTask, status: 'failed', updatedAt: new Date() });
          reject(new Error(state.context.error ?? 'Orchestrator failed'));
        }

        if (state.matches('cancelled')) {
          tasks.set(taskId, { ...updatedTask, status: 'cancelled', updatedAt: new Date() });
          reject(new Error('Task cancelled'));
        }
      });

      actor.start();
      actor.send({ type: 'START', intent });

      // Auto-approve architect output for now (UI approval hook comes later)
      actor.subscribe((state) => {
        if (state.matches('awaitingApproval')) {
          actor.send({ type: 'USER_APPROVED' });
        }
      });
    });
  }

  async getTask(taskId: string): Promise<AgentTask | null> {
    return tasks.get(taskId) ?? null;
  }

  async cancelTask(taskId: string): Promise<void> {
    const task = tasks.get(taskId);
    if (!task) return;
    tasks.set(taskId, { ...task, status: 'cancelled', updatedAt: new Date() });
  }
}
