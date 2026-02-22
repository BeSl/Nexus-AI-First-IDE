/**
 * Orchestrator Machine — Unit Tests
 * Tests the XState state machine transitions in isolation.
 */

import { describe, it, expect, vi } from 'vitest';
import { createActor, fromPromise } from 'xstate';
import { orchestratorMachine } from './orchestrator.machine.js';
import type { AgentActorInput } from './orchestrator.machine.js';
import type { AgentResult } from './orchestrator.types.js';

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeResult(role: string): AgentResult {
  return {
    taskId: 'test-task',
    agentId: 'test-agent' as import('./orchestrator.types.js').AgentId,
    output: { role },
    artifacts: [],
    duration: 10,
  };
}

function makeSuccessMachine(autoApprove = true) {
  const machine = orchestratorMachine.provide({
    actors: {
      runArchitect:   fromPromise<AgentResult, AgentActorInput>(async () => makeResult('architect')),
      runCoder:       fromPromise<AgentResult, AgentActorInput>(async () => makeResult('coder')),
      runShadowBuild: fromPromise<AgentResult, AgentActorInput>(async () => makeResult('shadow')),
      runReviewer:    fromPromise<AgentResult, AgentActorInput>(async () => makeResult('reviewer')),
      runTester:      fromPromise<AgentResult, AgentActorInput>(async () => makeResult('tester')),
    },
  });
  return { machine, autoApprove };
}

async function runToCompletion(
  machine: ReturnType<typeof makeSuccessMachine>['machine'],
  autoApprove = true
) {
  return new Promise<string>((resolve, reject) => {
    const actor = createActor(machine, {
      input: { taskId: 'test-task', intent: 'create a module' },
    });

    if (autoApprove) {
      actor.subscribe((state) => {
        if (state.matches('awaitingApproval')) {
          actor.send({ type: 'USER_APPROVED' });
        }
      });
    }

    actor.subscribe((state) => {
      if (state.status === 'done') {
        resolve(state.value as string);
      }
    });

    actor.start();
    actor.send({ type: 'START', intent: 'create a module' });

    setTimeout(() => reject(new Error('timeout')), 2000);
  });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('OrchestratorMachine', () => {
  it('starts in idle state', () => {
    const { machine } = makeSuccessMachine();
    const actor = createActor(machine, {
      input: { taskId: 't1', intent: 'test' },
    });
    actor.start();
    expect(actor.getSnapshot().value).toBe('idle');
  });

  it('transitions idle → architect on START', () => {
    const { machine } = makeSuccessMachine();
    const actor = createActor(machine, {
      input: { taskId: 't1', intent: 'test' },
    });
    actor.start();
    actor.send({ type: 'START', intent: 'build a parser' });
    expect(actor.getSnapshot().value).toBe('architect');
  });

  it('ignores START with empty intent', () => {
    const { machine } = makeSuccessMachine();
    const actor = createActor(machine, {
      input: { taskId: 't1', intent: '' },
    });
    actor.start();
    actor.send({ type: 'START', intent: '   ' });
    expect(actor.getSnapshot().value).toBe('idle');
  });

  it('reaches done after full Nexus Loop with auto-approval', async () => {
    const { machine } = makeSuccessMachine();
    const finalState = await runToCompletion(machine, true);
    expect(finalState).toBe('done');
  });

  it('waits in awaitingApproval before coding', async () => {
    const statesSeen: string[] = [];
    const { machine } = makeSuccessMachine();

    await new Promise<void>((resolve) => {
      const actor = createActor(machine, {
        input: { taskId: 't1', intent: 'test intent' },
      });

      let approved = false;
      actor.subscribe((state) => {
        const val = state.value as string;
        statesSeen.push(val);

        if (val === 'awaitingApproval' && !approved) {
          approved = true;
          setTimeout(() => {
            actor.send({ type: 'USER_APPROVED' });
          }, 50);
        }

        if (state.status === 'done') resolve();
      });

      actor.start();
      actor.send({ type: 'START', intent: 'test intent' });
    });

    expect(statesSeen).toContain('awaitingApproval');
    expect(statesSeen).toContain('coder');
    expect(statesSeen).toContain('done');
  });

  it('goes to failed when an agent throws', async () => {
    const machine = orchestratorMachine.provide({
      actors: {
        runArchitect:   fromPromise<AgentResult, AgentActorInput>(async () => {
          throw new Error('LLM rate limit');
        }),
        runCoder:       fromPromise<AgentResult, AgentActorInput>(async () => makeResult('coder')),
        runShadowBuild: fromPromise<AgentResult, AgentActorInput>(async () => makeResult('shadow')),
        runReviewer:    fromPromise<AgentResult, AgentActorInput>(async () => makeResult('reviewer')),
        runTester:      fromPromise<AgentResult, AgentActorInput>(async () => makeResult('tester')),
      },
    });

    const finalState = await new Promise<string>((resolve) => {
      const actor = createActor(machine, {
        input: { taskId: 't1', intent: 'fail test' },
      });
      actor.subscribe((state) => {
        if (state.status === 'done') resolve(state.value as string);
      });
      actor.start();
      actor.send({ type: 'START', intent: 'fail test' });
    });

    expect(finalState).toBe('failed');
  });

  it('accumulates artifacts across all agents', async () => {
    const withArtifacts = orchestratorMachine.provide({
      actors: {
        runArchitect: fromPromise<AgentResult, AgentActorInput>(async () => ({
          ...makeResult('architect'),
          artifacts: [{ type: 'schema' as const, path: 'a.types.ts', content: '' }],
        })),
        runCoder: fromPromise<AgentResult, AgentActorInput>(async () => ({
          ...makeResult('coder'),
          artifacts: [{ type: 'code' as const, path: 'a.ts', content: '' }],
        })),
        runShadowBuild: fromPromise<AgentResult, AgentActorInput>(async () => makeResult('shadow')),
        runReviewer:    fromPromise<AgentResult, AgentActorInput>(async () => makeResult('reviewer')),
        runTester: fromPromise<AgentResult, AgentActorInput>(async () => ({
          ...makeResult('tester'),
          artifacts: [{ type: 'test' as const, path: 'a.spec.ts', content: '' }],
        })),
      },
    });

    const finalContext = await new Promise<{ artifacts: readonly unknown[] }>((resolve) => {
      const actor = createActor(withArtifacts, {
        input: { taskId: 't1', intent: 'build with artifacts' },
      });
      actor.subscribe((state) => {
        if (state.matches('awaitingApproval')) actor.send({ type: 'USER_APPROVED' });
        if (state.status === 'done') resolve(state.context);
      });
      actor.start();
      actor.send({ type: 'START', intent: 'build with artifacts' });
    });

    expect(finalContext.artifacts).toHaveLength(3);
  });

  it('passes through shadowBuild state before reviewer', async () => {
    const statesSeen: string[] = [];
    const { machine } = makeSuccessMachine();

    await new Promise<void>((resolve) => {
      const actor = createActor(machine, { input: { taskId: 't1', intent: 'test' } });
      actor.subscribe((state) => {
        const val = state.value as string;
        if (!statesSeen.includes(val)) statesSeen.push(val);
        if (val === 'awaitingApproval') actor.send({ type: 'USER_APPROVED' });
        if (state.status === 'done') resolve();
      });
      actor.start();
      actor.send({ type: 'START', intent: 'test' });
    });

    expect(statesSeen).toContain('shadowBuild');
    const shadowIdx  = statesSeen.indexOf('shadowBuild');
    const reviewerIdx = statesSeen.indexOf('reviewer');
    expect(shadowIdx).toBeLessThan(reviewerIdx);
  });

  it('retries coder when shadowBuild fails (within MAX_RETRIES)', async () => {
    let coderCallCount = 0;
    let shadowCallCount = 0;

    const machine = orchestratorMachine.provide({
      actors: {
        runArchitect:   fromPromise<AgentResult, AgentActorInput>(async () => makeResult('architect')),
        runCoder:       fromPromise<AgentResult, AgentActorInput>(async () => {
          coderCallCount++;
          return makeResult('coder');
        }),
        runShadowBuild: fromPromise<AgentResult, AgentActorInput>(async () => {
          shadowCallCount++;
          if (shadowCallCount === 1) throw new Error('TS2345: type mismatch');
          return makeResult('shadow');
        }),
        runReviewer:    fromPromise<AgentResult, AgentActorInput>(async () => makeResult('reviewer')),
        runTester:      fromPromise<AgentResult, AgentActorInput>(async () => makeResult('tester')),
      },
    });

    const finalState = await new Promise<string>((resolve) => {
      const actor = createActor(machine, { input: { taskId: 't1', intent: 'retry test' } });
      actor.subscribe((state) => {
        if (state.matches('awaitingApproval')) actor.send({ type: 'USER_APPROVED' });
        if (state.status === 'done') resolve(state.value as string);
      });
      actor.start();
      actor.send({ type: 'START', intent: 'retry test' });
      setTimeout(() => resolve('timeout'), 3000);
    });

    expect(finalState).toBe('done');
    expect(coderCallCount).toBe(2);
    expect(shadowCallCount).toBe(2);
  });

  it('fails after MAX_RETRIES shadow build failures', async () => {
    const machine = orchestratorMachine.provide({
      actors: {
        runArchitect:   fromPromise<AgentResult, AgentActorInput>(async () => makeResult('architect')),
        runCoder:       fromPromise<AgentResult, AgentActorInput>(async () => makeResult('coder')),
        runShadowBuild: fromPromise<AgentResult, AgentActorInput>(async () => {
          throw new Error('persistent TS error');
        }),
        runReviewer:    fromPromise<AgentResult, AgentActorInput>(async () => makeResult('reviewer')),
        runTester:      fromPromise<AgentResult, AgentActorInput>(async () => makeResult('tester')),
      },
    });

    const finalState = await new Promise<string>((resolve) => {
      const actor = createActor(machine, { input: { taskId: 't1', intent: 'max retry test' } });
      actor.subscribe((state) => {
        if (state.matches('awaitingApproval')) actor.send({ type: 'USER_APPROVED' });
        if (state.status === 'done') resolve(state.value as string);
      });
      actor.start();
      actor.send({ type: 'START', intent: 'max retry test' });
      setTimeout(() => resolve('timeout'), 5000);
    });

    expect(finalState).toBe('failed');
  });
});
