/**
 * BuildOrchestrator — Unit Tests
 *
 * All I/O (fs, child_process) is mocked via injected interfaces.
 * Tests verify pipeline logic, error propagation, and fix suggestion flow.
 */

import { describe, it, expect, vi } from 'vitest';
import { BuildOrchestrator } from './BuildOrchestrator.js';
import type {
  IShadowFS,
  IErrorAnalyzer,
  IBuildRunner,
  BuildError,
  SuggestedFix,
} from './BuildOrchestrator.types.js';

// ── Mock factories ────────────────────────────────────────────────────────────

function makeShadowFS(overrides?: Partial<IShadowFS>): IShadowFS {
  return {
    prepare: vi.fn().mockResolvedValue('/shadow/task-123'),
    cleanup: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function makeAnalyzer(overrides?: Partial<IErrorAnalyzer>): IErrorAnalyzer {
  return {
    parse: vi.fn().mockReturnValue([]),
    suggest: vi.fn().mockResolvedValue(null),
    ...overrides,
  };
}

function makeRunner(
  overrides?: Partial<IBuildRunner>
): IBuildRunner {
  return {
    run: vi.fn().mockReturnValue({ stdout: 'Build succeeded', stderr: '', success: true }),
    ...overrides,
  };
}

function makeOrch(
  shadowFS?: Partial<IShadowFS>,
  analyzer?: Partial<IErrorAnalyzer>,
  runner?: Partial<IBuildRunner>
) {
  return new BuildOrchestrator(makeShadowFS(shadowFS), makeAnalyzer(analyzer), makeRunner(runner));
}

const BASE_OPTS = {
  taskId: 'task-123',
  buildCommand: 'npm run build',
  projectRoot: '/project',
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('BuildOrchestrator', () => {
  describe('successful build', () => {
    it('returns success=true and empty errors', async () => {
      const orch = makeOrch();
      const result = await orch.runShadowBuild(BASE_OPTS);

      expect(result.success).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.suggestedFix).toBeNull();
    });

    it('includes taskId and buildCommand in result', async () => {
      const result = await makeOrch().runShadowBuild(BASE_OPTS);

      expect(result.taskId).toBe('task-123');
      expect(result.buildCommand).toBe('npm run build');
    });

    it('always calls cleanup even on success', async () => {
      const shadowFS = makeShadowFS();
      const orch = new BuildOrchestrator(shadowFS, makeAnalyzer(), makeRunner());
      await orch.runShadowBuild(BASE_OPTS);

      expect(shadowFS.cleanup).toHaveBeenCalledWith('/shadow/task-123');
    });

    it('records non-negative durationMs', async () => {
      const result = await makeOrch().runShadowBuild(BASE_OPTS);
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    });

    it('does NOT call suggest() when build succeeds', async () => {
      const analyzer = makeAnalyzer();
      const orch = new BuildOrchestrator(makeShadowFS(), analyzer, makeRunner());
      await orch.runShadowBuild(BASE_OPTS);

      expect(analyzer.suggest).not.toHaveBeenCalled();
    });

    it('passes command and shadowDir to runner', async () => {
      const runner = makeRunner();
      const orch = new BuildOrchestrator(makeShadowFS(), makeAnalyzer(), runner);
      await orch.runShadowBuild(BASE_OPTS);

      expect(runner.run).toHaveBeenCalledWith('npm run build', '/shadow/task-123', 120_000);
    });
  });

  describe('failed build', () => {
    const failRunner = makeRunner({
      run: vi.fn().mockReturnValue({ stdout: '', stderr: 'TS error', success: false }),
    });

    it('returns success=false when runner reports failure', async () => {
      const orch = new BuildOrchestrator(makeShadowFS(), makeAnalyzer(), failRunner);
      const result = await orch.runShadowBuild(BASE_OPTS);

      expect(result.success).toBe(false);
    });

    it('calls analyzer.suggest() with parsed errors on failure', async () => {
      const errors: BuildError[] = [
        { file: 'src/a.ts', line: 1, column: 1, message: 'boom', severity: 'error' },
      ];
      const fix: SuggestedFix = {
        explanation: 'Add type annotation',
        confidence: 'medium',
        patches: [],
      };
      const analyzer = makeAnalyzer({
        parse: vi.fn().mockReturnValue(errors),
        suggest: vi.fn().mockResolvedValue(fix),
      });
      const runner = makeRunner({
        run: vi.fn().mockReturnValue({ stdout: '', stderr: 'error', success: false }),
      });

      const orch = new BuildOrchestrator(makeShadowFS(), analyzer, runner);
      const result = await orch.runShadowBuild(BASE_OPTS);

      expect(analyzer.suggest).toHaveBeenCalledWith(errors, '/shadow/task-123');
      expect(result.suggestedFix).toEqual(fix);
    });

    it('still calls cleanup when build fails', async () => {
      const shadowFS = makeShadowFS();
      const orch = new BuildOrchestrator(shadowFS, makeAnalyzer(), failRunner);
      await orch.runShadowBuild(BASE_OPTS);

      expect(shadowFS.cleanup).toHaveBeenCalled();
    });
  });

  describe('shadow prepare failure', () => {
    it('returns success=false if ShadowFS.prepare throws', async () => {
      const orch = makeOrch({
        prepare: vi.fn().mockRejectedValue(new Error('disk full')),
      });
      const result = await orch.runShadowBuild(BASE_OPTS);

      expect(result.success).toBe(false);
      expect(result.stderr).toContain('disk full');
    });
  });

  describe('cleanup failure (non-fatal)', () => {
    it('resolves successfully even if cleanup throws', async () => {
      const orch = makeOrch({
        cleanup: vi.fn().mockRejectedValue(new Error('permission denied')),
      });

      await expect(orch.runShadowBuild(BASE_OPTS)).resolves.toBeDefined();
    });
  });
});

// ── ErrorAnalyzer unit tests ──────────────────────────────────────────────────

describe('ErrorAnalyzer', async () => {
  const { ErrorAnalyzer } = await import('./ErrorAnalyzer.js');

  it('parses tsc error format', () => {
    const analyzer = new ErrorAnalyzer();
    const stdout = `src/foo.ts(12,5): error TS2345: Argument of type 'string' is not assignable.`;
    const errors = analyzer.parse(stdout, '');

    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({
      file: 'src/foo.ts',
      line: 12,
      column: 5,
      code: 'TS2345',
      severity: 'error',
    });
  });

  it('parses esbuild/vite error format', () => {
    const analyzer = new ErrorAnalyzer();
    const stderr = `src/bar.ts:7:3: error: Unexpected token`;
    const errors = analyzer.parse('', stderr);

    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({ file: 'src/bar.ts', line: 7, column: 3 });
  });

  it('deduplicates identical errors', () => {
    const analyzer = new ErrorAnalyzer();
    const line = `src/foo.ts(1,1): error TS2345: Same error.`;
    const errors = analyzer.parse(`${line}\n${line}`, '');

    expect(errors).toHaveLength(1);
  });

  it('returns null suggestion when no errors', async () => {
    const analyzer = new ErrorAnalyzer();
    const fix = await analyzer.suggest([], '/shadow');
    expect(fix).toBeNull();
  });

  it('returns low-confidence stub for unknown error codes', async () => {
    const analyzer = new ErrorAnalyzer();
    const errors: BuildError[] = [
      { file: 'src/x.ts', line: 1, column: 1, code: 'TS9999', message: 'Unknown issue', severity: 'error' },
    ];
    const fix = await analyzer.suggest(errors, '/shadow');
    expect(fix?.confidence).toBe('low');
    expect(fix?.patches).toHaveLength(0);
  });
});
