/**
 * Orchestrator — XState State Machine
 *
 * Defines the Nexus Loop lifecycle:
 *   intent → architect → coder → reviewer → tester → done
 *
 * Each state corresponds to an agent persona.
 * Failure at any step routes to `failed` with full error context.
 */

import { setup, assign, fromPromise } from 'xstate';
import type { AgentRole, AgentResult, Artifact } from './orchestrator.types.js';

// ── Machine Context ──────────────────────────────────────────────────────────

export interface OrchestratorContext {
  readonly taskId: string;
  readonly intent: string;
  readonly artifacts: readonly Artifact[];
  readonly currentRole: AgentRole | null;
  readonly results: readonly AgentResult[];
  readonly error: string | null;
}

// ── Events ───────────────────────────────────────────────────────────────────

export type OrchestratorEvent =
  | { type: 'START'; intent: string }
  | { type: 'AGENT_DONE'; result: AgentResult }
  | { type: 'AGENT_FAILED'; error: string }
  | { type: 'USER_APPROVED' }
  | { type: 'USER_REJECTED' }
  | { type: 'CANCEL' };

// ── Actor input shapes ────────────────────────────────────────────────────────

interface AgentActorInput {
  taskId: string;
  intent: string;
  artifacts: readonly Artifact[];
  role: AgentRole;
}

// ── Machine definition ───────────────────────────────────────────────────────

export const orchestratorMachine = setup({
  types: {
    context: {} as OrchestratorContext,
    events: {} as OrchestratorEvent,
    input: {} as { taskId: string; intent: string },
  },

  actors: {
    /** Injected at runtime — each key is an agent persona */
    runArchitect: fromPromise<AgentResult, AgentActorInput>(async () => {
      throw new Error('runArchitect actor must be provided at machine creation');
    }),
    runCoder: fromPromise<AgentResult, AgentActorInput>(async () => {
      throw new Error('runCoder actor must be provided at machine creation');
    }),
    runReviewer: fromPromise<AgentResult, AgentActorInput>(async () => {
      throw new Error('runReviewer actor must be provided at machine creation');
    }),
    runTester: fromPromise<AgentResult, AgentActorInput>(async () => {
      throw new Error('runTester actor must be provided at machine creation');
    }),
  },

  actions: {
    appendResult: assign({
      results: ({ context, event }) => {
        if (event.type !== 'AGENT_DONE') return context.results;
        return [...context.results, event.result];
      },
      artifacts: ({ context, event }) => {
        if (event.type !== 'AGENT_DONE') return context.artifacts;
        return [...context.artifacts, ...event.result.artifacts];
      },
    }),
    setError: assign({
      error: ({ event }) =>
        event.type === 'AGENT_FAILED' ? event.error : 'Unknown error',
    }),
  },
}).createMachine({
  id: 'orchestrator',
  initial: 'idle',

  context: ({ input }) => ({
    taskId: input.taskId,
    intent: input.intent,
    artifacts: [],
    currentRole: null,
    results: [],
    error: null,
  }),

  states: {
    idle: {
      on: {
        START: {
          target: 'architect',
          guard: ({ event }) => event.intent.trim().length > 0,
        },
      },
    },

    architect: {
      entry: assign({ currentRole: 'architect' as AgentRole }),
      invoke: {
        src: 'runArchitect',
        input: ({ context }) => ({
          taskId: context.taskId,
          intent: context.intent,
          artifacts: context.artifacts,
          role: 'architect' as AgentRole,
        }),
        onDone: {
          target: 'awaitingApproval',
          actions: assign({
            results: ({ context, event }) => [...context.results, event.output],
            artifacts: ({ context, event }) => [...context.artifacts, ...event.output.artifacts],
          }),
        },
        onError: {
          target: 'failed',
          actions: assign({ error: ({ event }) => String(event.error) }),
        },
      },
      on: { CANCEL: 'cancelled' },
    },

    /** User reviews Architect's blueprint before code is written */
    awaitingApproval: {
      entry: assign({ currentRole: null }),
      on: {
        USER_APPROVED: 'coder',
        USER_REJECTED: 'idle',
        CANCEL: 'cancelled',
      },
    },

    coder: {
      entry: assign({ currentRole: 'coder' as AgentRole }),
      invoke: {
        src: 'runCoder',
        input: ({ context }) => ({
          taskId: context.taskId,
          intent: context.intent,
          artifacts: context.artifacts,
          role: 'coder' as AgentRole,
        }),
        onDone: {
          target: 'reviewer',
          actions: assign({
            results: ({ context, event }) => [...context.results, event.output],
            artifacts: ({ context, event }) => [...context.artifacts, ...event.output.artifacts],
          }),
        },
        onError: {
          target: 'failed',
          actions: assign({ error: ({ event }) => String(event.error) }),
        },
      },
      on: { CANCEL: 'cancelled' },
    },

    reviewer: {
      entry: assign({ currentRole: 'reviewer' as AgentRole }),
      invoke: {
        src: 'runReviewer',
        input: ({ context }) => ({
          taskId: context.taskId,
          intent: context.intent,
          artifacts: context.artifacts,
          role: 'reviewer' as AgentRole,
        }),
        onDone: {
          target: 'tester',
          actions: assign({
            results: ({ context, event }) => [...context.results, event.output],
            artifacts: ({ context, event }) => [...context.artifacts, ...event.output.artifacts],
          }),
        },
        onError: {
          target: 'failed',
          actions: assign({ error: ({ event }) => String(event.error) }),
        },
      },
      on: { CANCEL: 'cancelled' },
    },

    tester: {
      entry: assign({ currentRole: 'tester' as AgentRole }),
      invoke: {
        src: 'runTester',
        input: ({ context }) => ({
          taskId: context.taskId,
          intent: context.intent,
          artifacts: context.artifacts,
          role: 'tester' as AgentRole,
        }),
        onDone: {
          target: 'done',
          actions: assign({
            results: ({ context, event }) => [...context.results, event.output],
            artifacts: ({ context, event }) => [...context.artifacts, ...event.output.artifacts],
          }),
        },
        onError: {
          target: 'failed',
          actions: assign({ error: ({ event }) => String(event.error) }),
        },
      },
      on: { CANCEL: 'cancelled' },
    },

    done: { type: 'final' },
    failed: { type: 'final' },
    cancelled: { type: 'final' },
  },
});
