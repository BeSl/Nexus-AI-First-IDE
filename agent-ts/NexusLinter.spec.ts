/**
 * NexusLinter — Unit Tests
 */
import { describe, it, expect } from 'vitest';
import { NexusLinter } from './NexusLinter.js';

const linter = new NexusLinter();

// ── NEXUS-001: no any ─────────────────────────────────────────────────────────

describe('NEXUS-001 — no any', () => {
  it('flags ": any" annotation', () => {
    const v = linter.lint('function foo(x: any): void {}', 'src/foo.ts').violations;
    expect(v.some((x) => x.rule === 'NEXUS-001')).toBe(true);
  });

  it('flags "as any" cast', () => {
    const v = linter.lint('const x = value as any;', 'src/foo.ts').violations;
    expect(v.some((x) => x.rule === 'NEXUS-001')).toBe(true);
  });

  it('passes clean code', () => {
    const v = linter.lint('function foo(x: string): void {}', 'src/foo.ts').violations;
    expect(v.filter((x) => x.rule === 'NEXUS-001')).toHaveLength(0);
  });
});

// ── NEXUS-002: no secrets ─────────────────────────────────────────────────────

describe('NEXUS-002 — no hardcoded secrets', () => {
  it('flags hardcoded apiKey', () => {
    const v = linter.lint("const apiKey = 'sk-abc123xyz';", 'src/foo.ts').violations;
    expect(v.some((x) => x.rule === 'NEXUS-002')).toBe(true);
  });

  it('flags hardcoded password', () => {
    const v = linter.lint('const password = "supersecret";', 'src/foo.ts').violations;
    expect(v.some((x) => x.rule === 'NEXUS-002')).toBe(true);
  });

  it('passes env variable usage', () => {
    const v = linter.lint('const apiKey = process.env.API_KEY;', 'src/foo.ts').violations;
    expect(v.filter((x) => x.rule === 'NEXUS-002')).toHaveLength(0);
  });
});

// ── NEXUS-003: no direct fs ───────────────────────────────────────────────────

describe('NEXUS-003 — no direct fs', () => {
  it('flags fs.readFileSync', () => {
    const v = linter.lint("fs.readFileSync('/etc/passwd', 'utf-8');", 'src/foo.ts').violations;
    expect(v.some((x) => x.rule === 'NEXUS-003')).toBe(true);
  });

  it('flags fs.writeFileSync', () => {
    const v = linter.lint("fs.writeFileSync('out.txt', data);", 'src/foo.ts').violations;
    expect(v.some((x) => x.rule === 'NEXUS-003')).toBe(true);
  });

  it('passes readFile (async variant)', () => {
    const v = linter.lint("await fs.promises.readFile('foo.ts');", 'src/foo.ts').violations;
    expect(v.filter((x) => x.rule === 'NEXUS-003')).toHaveLength(0);
  });
});

// ── NEXUS-005: max lines ──────────────────────────────────────────────────────

describe('NEXUS-005 — max 150 lines', () => {
  it('flags file with 151 lines', () => {
    const source = Array.from({ length: 151 }, (_, i) => `// ${i}`).join('\n');
    const v = linter.lint(source, 'src/big.ts').violations;
    expect(v.some((x) => x.rule === 'NEXUS-005')).toBe(true);
  });

  it('passes file with exactly 150 lines', () => {
    const source = Array.from({ length: 150 }, (_, i) => `// ${i}`).join('\n');
    const v = linter.lint(source, 'src/ok.ts').violations;
    expect(v.filter((x) => x.rule === 'NEXUS-005')).toHaveLength(0);
  });
});

// ── NEXUS-006: private hash ───────────────────────────────────────────────────

describe('NEXUS-006 — private # prefix', () => {
  it('flags private underscore field', () => {
    const v = linter.lint('class Foo { private _name = "x"; }', 'src/foo.ts').violations;
    expect(v.some((x) => x.rule === 'NEXUS-006')).toBe(true);
  });

  it('passes private hash field', () => {
    const v = linter.lint('class Foo { readonly #name = "x"; }', 'src/foo.ts').violations;
    expect(v.filter((x) => x.rule === 'NEXUS-006')).toHaveLength(0);
  });
});

// ── NEXUS-007: no console.log ─────────────────────────────────────────────────

describe('NEXUS-007 — no console.log', () => {
  it('flags console.log', () => {
    const v = linter.lint('console.log("debug");', 'src/foo.ts').violations;
    expect(v.some((x) => x.rule === 'NEXUS-007')).toBe(true);
  });
});

// ── NEXUS-008: implements clause ──────────────────────────────────────────────

describe('NEXUS-008 — class implements interface', () => {
  it('flags exported class without implements', () => {
    const v = linter.lint('export class Foo {}', 'src/foo.ts').violations;
    expect(v.some((x) => x.rule === 'NEXUS-008')).toBe(true);
  });

  it('passes class with implements', () => {
    const v = linter.lint('export class Foo implements IFoo {}', 'src/foo.ts').violations;
    expect(v.filter((x) => x.rule === 'NEXUS-008')).toHaveLength(0);
  });

  it('does not flag non-exported class', () => {
    const v = linter.lint('class Internal {}', 'src/foo.ts').violations;
    expect(v.filter((x) => x.rule === 'NEXUS-008')).toHaveLength(0);
  });
});

// ── passed flag ───────────────────────────────────────────────────────────────

describe('LintResult.passed', () => {
  it('passed is false when critical violation found', () => {
    const result = linter.lint('const x: any = 1;', 'src/foo.ts');
    expect(result.passed).toBe(false);
  });

  it('passed is true when only warnings found', () => {
    const result = linter.lint('console.log("hi");', 'src/foo.ts');
    expect(result.passed).toBe(true);
  });

  it('summarize counts critical violations', () => {
    const r1 = linter.lint('const x: any = 1;', 'a.ts');
    const r2 = linter.lint('console.log("x");', 'b.ts');
    const sum = NexusLinter.summarize([r1, r2]);
    expect(sum.criticalViolations).toBeGreaterThan(0);
    expect(sum.passed).toBe(false);
  });
});
