/**
 * LspToolProvider — Unit Tests
 *
 * All tests use a mock ITypeScriptService — no disk I/O, no Compiler API.
 */

import { describe, it, expect, vi } from 'vitest';
import { LspToolProvider } from './LspToolProvider.js';
import type { ITypeScriptService, LspDiagnostic, TypeCoverageResult, ExportInfo } from './lsp.types.js';

// ── Mock factory ───────────────────────────────────────────────────────────────

function makeMock(): ITypeScriptService {
  return {
    getDiagnostics: vi.fn().mockReturnValue([]),
    getTypeCoverage: vi.fn().mockReturnValue({ totalNodes: 0, anyCount: 0, percentage: 100 }),
    findExport: vi.fn().mockReturnValue([]),
  };
}

// ── getTools ───────────────────────────────────────────────────────────────────

describe('LspToolProvider.getTools', () => {
  it('exposes ts_diagnostics, ts_type_coverage, ts_find_export', () => {
    const provider = new LspToolProvider(makeMock());
    const names = provider.getTools().map((t) => t.name);
    expect(names).toContain('ts_diagnostics');
    expect(names).toContain('ts_type_coverage');
    expect(names).toContain('ts_find_export');
  });
});

// ── handles ────────────────────────────────────────────────────────────────────

describe('LspToolProvider.handles', () => {
  it('returns true for known tools', () => {
    const provider = new LspToolProvider(makeMock());
    expect(provider.handles('ts_diagnostics')).toBe(true);
    expect(provider.handles('ts_type_coverage')).toBe(true);
    expect(provider.handles('ts_find_export')).toBe(true);
  });

  it('returns false for unknown tools', () => {
    const provider = new LspToolProvider(makeMock());
    expect(provider.handles('context_query')).toBe(false);
    expect(provider.handles('vector_search')).toBe(false);
  });
});

// ── dispatch: ts_diagnostics ──────────────────────────────────────────────────

describe('LspToolProvider.dispatch — ts_diagnostics', () => {
  it('calls getDiagnostics with filePath', async () => {
    const mock = makeMock();
    const provider = new LspToolProvider(mock);
    const result = await provider.dispatch('ts_diagnostics', { filePath: '/src/foo.ts' });
    expect(mock.getDiagnostics).toHaveBeenCalledWith('/src/foo.ts', undefined);
    expect(result.isError).toBe(false);
    expect(result.toolName).toBe('ts_diagnostics');
  });

  it('forwards sourceOverride', async () => {
    const mock = makeMock();
    const provider = new LspToolProvider(mock);
    await provider.dispatch('ts_diagnostics', { filePath: '/a.ts', sourceOverride: 'const x = 1;' });
    expect(mock.getDiagnostics).toHaveBeenCalledWith('/a.ts', 'const x = 1;');
  });

  it('returns serialized diagnostics in content', async () => {
    const diag: LspDiagnostic = {
      filePath: '/src/foo.ts', line: 3, character: 5,
      message: 'Type error', code: 2345, category: 'error',
    };
    const mock = makeMock();
    vi.mocked(mock.getDiagnostics).mockReturnValue([diag]);
    const provider = new LspToolProvider(mock);
    const result = await provider.dispatch('ts_diagnostics', { filePath: '/src/foo.ts' });
    const parsed = JSON.parse(result.content) as LspDiagnostic[];
    expect(parsed[0]!.message).toBe('Type error');
  });
});

// ── dispatch: ts_type_coverage ────────────────────────────────────────────────

describe('LspToolProvider.dispatch — ts_type_coverage', () => {
  it('calls getTypeCoverage with file paths', async () => {
    const mock = makeMock();
    const provider = new LspToolProvider(mock);
    const result = await provider.dispatch('ts_type_coverage', { filePaths: ['/a.ts', '/b.ts'] });
    expect(mock.getTypeCoverage).toHaveBeenCalledWith(['/a.ts', '/b.ts']);
    expect(result.isError).toBe(false);
  });

  it('handles missing filePaths gracefully', async () => {
    const mock = makeMock();
    const provider = new LspToolProvider(mock);
    await provider.dispatch('ts_type_coverage', {});
    expect(mock.getTypeCoverage).toHaveBeenCalledWith([]);
  });

  it('returns coverage result in content', async () => {
    const coverage: TypeCoverageResult = { totalNodes: 10, anyCount: 2, percentage: 80 };
    const mock = makeMock();
    vi.mocked(mock.getTypeCoverage).mockReturnValue(coverage);
    const provider = new LspToolProvider(mock);
    const result = await provider.dispatch('ts_type_coverage', { filePaths: ['/x.ts'] });
    const parsed = JSON.parse(result.content) as TypeCoverageResult;
    expect(parsed.percentage).toBe(80);
  });
});

// ── dispatch: ts_find_export ──────────────────────────────────────────────────

describe('LspToolProvider.dispatch — ts_find_export', () => {
  it('calls findExport with symbolName and paths', async () => {
    const mock = makeMock();
    const provider = new LspToolProvider(mock);
    await provider.dispatch('ts_find_export', { symbolName: 'Foo', filePaths: ['/src/Foo.ts'] });
    expect(mock.findExport).toHaveBeenCalledWith('Foo', ['/src/Foo.ts']);
  });

  it('returns export info in content', async () => {
    const info: ExportInfo = { name: 'Foo', filePath: '/src/Foo.ts', line: 7, kind: 'class' };
    const mock = makeMock();
    vi.mocked(mock.findExport).mockReturnValue([info]);
    const provider = new LspToolProvider(mock);
    const result = await provider.dispatch('ts_find_export', { symbolName: 'Foo', filePaths: ['/src/Foo.ts'] });
    const parsed = JSON.parse(result.content) as ExportInfo[];
    expect(parsed[0]!.kind).toBe('class');
  });
});

// ── dispatch: unknown tool ────────────────────────────────────────────────────

describe('LspToolProvider.dispatch — unknown tool', () => {
  it('returns isError=true for unknown tool name', async () => {
    const provider = new LspToolProvider(makeMock());
    const result = await provider.dispatch('no_such_tool', {});
    expect(result.isError).toBe(true);
    const parsed = JSON.parse(result.content) as { error: string };
    expect(parsed.error).toContain('no_such_tool');
  });
});
