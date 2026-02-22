/**
 * OrchestratorBridge — Unit Tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OrchestratorBridge } from './OrchestratorBridge.js';
import type { IWebviewSender, IOrchestratorSnapshot } from './OrchestratorBridge.js';
import type { DiffMessage } from './webview.types.js';
import type { BuildResult } from '../core/builder/BuildOrchestrator.types.js';

// ── Mocks ─────────────────────────────────────────────────────────────────────

function makeSender(): IWebviewSender {
  return { postMessage: vi.fn() };
}

const SNAP: IOrchestratorSnapshot = {
  value: 'architect',
  context: { activeRole: 'architect', currentTaskId: 'task-1', status: 'running' },
};

const PROGRESS = [{ role: 'architect' as const, status: 'active' as const }];

function makeBuildResult(success = false): BuildResult {
  return {
    success, taskId: 'task-1', shadowDir: '/tmp/shadow',
    buildCommand: 'npm run build', durationMs: 1200,
    stdout: '', stderr: '',
    errors: success ? [] : [{ file: 'src/a.ts', line: 5, column: 1, message: 'error', severity: 'error' }],
    suggestedFix: null,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('OrchestratorBridge lifecycle', () => {
  it('starts not running', () => {
    const bridge = new OrchestratorBridge(makeSender());
    expect(bridge.isRunning).toBe(false);
  });

  it('start() sets isRunning true', () => {
    const bridge = new OrchestratorBridge(makeSender());
    bridge.start();
    expect(bridge.isRunning).toBe(true);
  });

  it('stop() sets isRunning false', () => {
    const bridge = new OrchestratorBridge(makeSender());
    bridge.start();
    bridge.stop();
    expect(bridge.isRunning).toBe(false);
  });
});

describe('OrchestratorBridge.onStateChange', () => {
  let sender: IWebviewSender; let bridge: OrchestratorBridge;
  beforeEach(() => { sender = makeSender(); bridge = new OrchestratorBridge(sender); bridge.start(); });

  it('posts orchestrator:state message', () => {
    bridge.onStateChange(SNAP, PROGRESS);
    expect(sender.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'orchestrator:state' }),
    );
  });

  it('message contains currentState from snapshot', () => {
    bridge.onStateChange(SNAP, PROGRESS);
    const msg = (sender.postMessage as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
    expect(msg.state.currentState).toBe('architect');
  });

  it('deduplicates identical consecutive states', () => {
    bridge.onStateChange(SNAP, PROGRESS);
    bridge.onStateChange(SNAP, PROGRESS);
    expect(sender.postMessage).toHaveBeenCalledTimes(1);
  });

  it('resolves nested XState value to first key', () => {
    const nested: IOrchestratorSnapshot = { value: { coder: 'building' }, context: {} };
    bridge.onStateChange(nested, []);
    const msg = (sender.postMessage as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
    expect(msg.state.currentState).toBe('coder');
  });

  it('does not post when bridge is stopped', () => {
    bridge.stop();
    bridge.onStateChange(SNAP, PROGRESS);
    expect(sender.postMessage).not.toHaveBeenCalled();
  });
});

describe('OrchestratorBridge.onBuildResult', () => {
  let sender: IWebviewSender; let bridge: OrchestratorBridge;
  beforeEach(() => { sender = makeSender(); bridge = new OrchestratorBridge(sender); bridge.start(); });

  it('posts build:result message', () => {
    bridge.onBuildResult(makeBuildResult(true));
    expect(sender.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'build:result', success: true }),
    );
  });

  it('includes error count', () => {
    bridge.onBuildResult(makeBuildResult(false));
    const msg = (sender.postMessage as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
    expect(msg.errorCount).toBe(1);
  });

  it('includes formatted feedback for failures', () => {
    bridge.onBuildResult(makeBuildResult(false));
    const msg = (sender.postMessage as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
    expect(msg.feedback).toContain('FAILED');
  });

  it('feedback is empty string for successful builds', () => {
    bridge.onBuildResult(makeBuildResult(true));
    const msg = (sender.postMessage as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
    expect(msg.feedback).toBe('');
  });
});

describe('OrchestratorBridge.onDiffReady', () => {
  it('forwards diff message to webview', () => {
    const sender = makeSender();
    const bridge = new OrchestratorBridge(sender);
    bridge.start();
    const diff: DiffMessage = {
      type: 'diff:show', taskId: 'task-1',
      files: [{ path: 'src/foo.ts', before: '', after: 'export class Foo {}', lintViolations: [] }],
    };
    bridge.onDiffReady(diff);
    expect(sender.postMessage).toHaveBeenCalledWith(diff);
  });
});
