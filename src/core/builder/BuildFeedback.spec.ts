/**
 * BuildFeedback — Unit Tests
 */
import { describe, it, expect } from 'vitest';
import { BuildFeedback } from './BuildFeedback.js';
import type { BuildResult, BuildError } from './BuildOrchestrator.types.js';

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeError(overrides: Partial<BuildError> = {}): BuildError {
  return {
    file: 'src/foo.ts',
    line: 12,
    column: 5,
    message: "Type 'string' is not assignable to type 'number'",
    code: 'TS2322',
    severity: 'error',
    ...overrides,
  };
}

function makeResult(overrides: Partial<BuildResult> = {}): BuildResult {
  return {
    success: false,
    taskId: 'task-abc',
    shadowDir: '/tmp/.nexus/shadow-build/task-abc',
    buildCommand: 'npm run build',
    durationMs: 3200,
    stdout: '',
    stderr: '',
    errors: [makeError()],
    suggestedFix: null,
    ...overrides,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('BuildFeedback.toMessages', () => {
  it('returns empty array for successful build', () => {
    const result = makeResult({ success: true, errors: [] });
    expect(BuildFeedback.toMessages(result)).toHaveLength(0);
  });

  it('returns one user message for failed build', () => {
    const msgs = BuildFeedback.toMessages(makeResult());
    expect(msgs).toHaveLength(1);
    expect(msgs[0]?.role).toBe('user');
  });

  it('message content includes error details', () => {
    const msgs = BuildFeedback.toMessages(makeResult());
    expect(msgs[0]?.content).toContain('TS2322');
    expect(msgs[0]?.content).toContain('src/foo.ts');
  });
});

describe('BuildFeedback.format', () => {
  it('includes task id and command', () => {
    const text = BuildFeedback.format(makeResult());
    expect(text).toContain('task-abc');
    expect(text).toContain('npm run build');
  });

  it('formats error with file:line:col pattern', () => {
    const text = BuildFeedback.format(makeResult());
    expect(text).toContain('src/foo.ts:12:5');
  });

  it('includes error code', () => {
    const text = BuildFeedback.format(makeResult());
    expect(text).toContain('[TS2322]');
  });

  it('truncates errors beyond MAX_ERRORS=20', () => {
    const errors = Array.from({ length: 25 }, (_, i) =>
      makeError({ line: i + 1, code: `TS${i}` }),
    );
    const text = BuildFeedback.format(makeResult({ errors }));
    expect(text).toContain('5 more errors');
  });

  it('includes suggested fix when present', () => {
    const fix = {
      explanation: 'Add .js extension to imports',
      confidence: 'high' as const,
      patches: [{ uri: 'src/foo.ts', patch: '', explanation: 'Change import path' }],
    };
    const text = BuildFeedback.format(makeResult({ suggestedFix: fix }));
    expect(text).toContain('Add .js extension to imports');
    expect(text).toContain('confidence: high');
  });

  it('includes Coder task instructions', () => {
    const text = BuildFeedback.format(makeResult());
    expect(text).toContain('Fix ALL errors');
  });
});

describe('BuildFeedback.byFile', () => {
  it('groups errors by file path', () => {
    const errors = [
      makeError({ file: 'src/a.ts', line: 1 }),
      makeError({ file: 'src/a.ts', line: 2 }),
      makeError({ file: 'src/b.ts', line: 5 }),
    ];
    const map = BuildFeedback.byFile(makeResult({ errors }));
    expect(map.get('src/a.ts')).toHaveLength(2);
    expect(map.get('src/b.ts')).toHaveLength(1);
  });

  it('returns empty map for no errors', () => {
    const map = BuildFeedback.byFile(makeResult({ errors: [] }));
    expect(map.size).toBe(0);
  });
});
