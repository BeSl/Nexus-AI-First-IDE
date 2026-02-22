/**
 * TypeScriptService — Unit Tests
 *
 * Tests use sourceOverride to run completely in-memory (no disk I/O).
 * getDiagnostics with override is the primary test vector.
 */

import { describe, it, expect } from 'vitest';
import { TypeScriptService } from './TypeScriptService.js';

const svc = new TypeScriptService();
const FAKE_PATH = '/fake/test.ts';

// ── getDiagnostics ─────────────────────────────────────────────────────────────

describe('TypeScriptService.getDiagnostics', () => {
  it('returns no diagnostics for valid TS', () => {
    const source = `const x: number = 42;`;
    const result = svc.getDiagnostics(FAKE_PATH, source);
    expect(result).toHaveLength(0);
  });

  it('detects type error', () => {
    const source = `const x: number = 'hello';`;
    const result = svc.getDiagnostics(FAKE_PATH, source);
    expect(result.length).toBeGreaterThan(0);
    expect(result[0]!.category).toBe('error');
    expect(result[0]!.filePath).toBe(FAKE_PATH);
    expect(result[0]!.line).toBe(1);
  });

  it('detects syntax error', () => {
    const source = `const x = {`;
    const result = svc.getDiagnostics(FAKE_PATH, source);
    expect(result.length).toBeGreaterThan(0);
    expect(result[0]!.category).toBe('error');
  });

  it('returns line/character positions', () => {
    const source = `const a = 1;\nconst b: string = 99;`;
    const result = svc.getDiagnostics(FAKE_PATH, source);
    expect(result.length).toBeGreaterThan(0);
    expect(result[0]!.line).toBe(2);
  });

  it('returns empty array for non-existent file without override', () => {
    const result = svc.getDiagnostics('/does/not/exist.ts');
    expect(result).toHaveLength(0);
  });
});

// ── getTypeCoverage ────────────────────────────────────────────────────────────

describe('TypeScriptService.getTypeCoverage', () => {
  it('returns 100% for empty file list', () => {
    const result = svc.getTypeCoverage([]);
    expect(result.percentage).toBe(100);
    expect(result.totalNodes).toBe(0);
  });

  it('returns 100% for file that does not exist', () => {
    const result = svc.getTypeCoverage(['/nonexistent.ts']);
    expect(result.percentage).toBe(100);
  });
});

// ── findExport ─────────────────────────────────────────────────────────────────

describe('TypeScriptService.findExport', () => {
  it('returns empty for unknown symbol', () => {
    const result = svc.findExport('nonExistent', []);
    expect(result).toHaveLength(0);
  });

  it('returns empty for non-existent files', () => {
    const result = svc.findExport('foo', ['/nonexistent.ts']);
    expect(result).toHaveLength(0);
  });
});
