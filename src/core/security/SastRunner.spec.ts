/**
 * SastRunner — Unit Tests
 */
import { describe, it, expect } from 'vitest';
import { SastRunner } from './SastRunner.js';
import type { Artifact } from '../../../core/orchestrator.types.js';

function art(path: string, content: string, type: Artifact['type'] = 'code'): Artifact {
  return { type, path, content };
}

const CLEAN = art('src/Foo.ts', '/** Foo service. @security read-only */\nexport class Foo implements IFoo { readonly #x = 1; }');
const ANY_ART = art('src/Bar.ts', 'function bar(x: any): void {}');
const LONG_ART = art('src/Big.ts', Array.from({ length: 160 }, (_, i) => `// ${i}`).join('\n'));
const SECRET_ART = art('src/Cfg.ts', "const apiKey = 'sk-abc123xyz9999';");

describe('SastRunner.run — no artifacts', () => {
  it('passes with empty artifacts', () => {
    expect(new SastRunner().run([])).toMatchObject({ passed: true });
  });

  it('skips test artifacts', () => {
    const result = new SastRunner().run([art('src/a.spec.ts', 'describe()', 'test')]);
    expect(result.fileResults).toHaveLength(0);
  });
});

describe('SastRunner.run — clean code', () => {
  it('passes with no violations', () => {
    const result = new SastRunner().run([CLEAN]);
    expect(result.passed).toBe(true);
    expect(result.summary.criticalViolations).toBe(0);
  });

  it('report mentions no violations', () => {
    const result = new SastRunner().run([CLEAN]);
    expect(result.report).toContain('passed');
  });
});

describe('SastRunner.run — critical violations', () => {
  it('fails on any type', () => {
    const result = new SastRunner().run([ANY_ART]);
    expect(result.passed).toBe(false);
    expect(result.summary.criticalViolations).toBeGreaterThan(0);
  });

  it('fails on hardcoded secret', () => {
    const result = new SastRunner().run([SECRET_ART]);
    expect(result.passed).toBe(false);
  });

  it('report contains rule ID for critical violation', () => {
    const result = new SastRunner().run([ANY_ART]);
    expect(result.report).toContain('NEXUS-001');
  });
});

describe('SastRunner.run — warnings only', () => {
  it('passed is true with only warnings', () => {
    const result = new SastRunner().run([LONG_ART]);
    expect(result.passed).toBe(true);
  });

  it('summary counts warning violations', () => {
    const result = new SastRunner().run([LONG_ART]);
    expect(result.summary.totalViolations).toBeGreaterThan(0);
    expect(result.summary.criticalViolations).toBe(0);
  });
});

describe('SastRunner.run — multiple files', () => {
  it('aggregates violations across files', () => {
    const result = new SastRunner().run([CLEAN, ANY_ART, LONG_ART]);
    expect(result.fileResults).toHaveLength(3);
    expect(result.summary.filesWithViolations).toBeGreaterThanOrEqual(1);
  });

  it('report lists each file with violations', () => {
    const result = new SastRunner().run([ANY_ART, LONG_ART]);
    expect(result.report).toContain('src/Bar.ts');
  });
});
