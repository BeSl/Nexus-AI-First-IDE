/**
 * ContextEngine — Unit Tests
 * All file I/O is replaced by in-memory IFileReader mock.
 */
import { describe, it, expect, vi } from 'vitest';
import { ContextEngine } from './ContextEngine.js';
import type { IFileReader } from './ContextEngine.js';

// ── Mock file reader factory ──────────────────────────────────────────────────

function makeReader(files: Record<string, string>): IFileReader {
  return { read: vi.fn(async (uri: string) => files[uri] ?? '') };
}

const AUTH_SRC = `
export interface IAuthService { login(user: string): Promise<string>; }
export class AuthService implements IAuthService {
  login(user: string): Promise<string> { return Promise.resolve('token'); }
}`;

const DB_SRC = `
export interface IDatabase { query(sql: string): Promise<unknown[]>; }
export class DatabaseService implements IDatabase {
  query(sql: string): Promise<unknown[]> { return Promise.resolve([]); }
}`;

const UTIL_SRC = `export function noop(): void { /* nothing */ }`;

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('ContextEngine.index', () => {
  it('indexes files and makes them queryable', async () => {
    const engine = new ContextEngine(makeReader({ 'auth.ts': AUTH_SRC }));
    await engine.index(['auth.ts']);
    const result = await engine.query({ intent: 'login authentication' });
    expect(result.skeletons).toHaveLength(1);
    expect(result.skeletons[0]?.uri).toBe('auth.ts');
  });

  it('calls reader once per URI', async () => {
    const reader = makeReader({ 'a.ts': UTIL_SRC });
    const engine = new ContextEngine(reader);
    await engine.index(['a.ts']);
    expect(reader.read).toHaveBeenCalledTimes(1);
  });
});

describe('ContextEngine.query — keyword ranking', () => {
  it('returns the most relevant file first', async () => {
    const reader = makeReader({ 'auth.ts': AUTH_SRC, 'db.ts': DB_SRC });
    const engine = new ContextEngine(reader);
    await engine.index(['auth.ts', 'db.ts']);

    const result = await engine.query({ intent: 'database sql query' });
    expect(result.skeletons[0]?.uri).toBe('db.ts');
  });

  it('returns empty array when index is empty', async () => {
    const engine = new ContextEngine(makeReader({}));
    const result = await engine.query({ intent: 'anything' });
    expect(result.skeletons).toHaveLength(0);
    expect(result.totalTokens).toBe(0);
  });

  it('respects topK limit', async () => {
    const files: Record<string, string> = {};
    for (let i = 0; i < 5; i++) files[`f${i}.ts`] = `export function fn${i}(): void {}`;
    const engine = new ContextEngine(makeReader(files));
    await engine.index(Object.keys(files));

    const result = await engine.query({ intent: 'function export', topK: 2 });
    expect(result.skeletons.length).toBeLessThanOrEqual(2);
  });

  it('respects maxTokens budget', async () => {
    const reader = makeReader({ 'auth.ts': AUTH_SRC, 'db.ts': DB_SRC });
    const engine = new ContextEngine(reader);
    await engine.index(['auth.ts', 'db.ts']);

    // Budget of 1 token: no file should fit (skeletons are larger)
    const result = await engine.query({ intent: 'login', maxTokens: 1 });
    expect(result.skeletons).toHaveLength(0);
    expect(result.totalTokens).toBe(0);
  });
});

describe('ContextEngine.query — scope filtering', () => {
  it('filters by scope pattern', async () => {
    const reader = makeReader({ 'src/auth.ts': AUTH_SRC, 'src/db.ts': DB_SRC });
    const engine = new ContextEngine(reader);
    await engine.index(['src/auth.ts', 'src/db.ts']);

    const result = await engine.query({ intent: 'anything', scope: ['auth'] });
    expect(result.skeletons).toHaveLength(1);
    expect(result.skeletons[0]?.uri).toBe('src/auth.ts');
  });

  it('returns nothing if scope matches no files', async () => {
    const reader = makeReader({ 'auth.ts': AUTH_SRC });
    const engine = new ContextEngine(reader);
    await engine.index(['auth.ts']);

    const result = await engine.query({ intent: 'anything', scope: ['nonexistent'] });
    expect(result.skeletons).toHaveLength(0);
  });
});

describe('ContextEngine.query — result shape', () => {
  it('ContextResult has correct shape', async () => {
    const engine = new ContextEngine(makeReader({ 'a.ts': AUTH_SRC }));
    await engine.index(['a.ts']);
    const result = await engine.query({ intent: 'login' });

    expect(result.query.intent).toBe('login');
    expect(result.ragChunks).toEqual([]);
    expect(result.totalTokens).toBeGreaterThan(0);
    expect(result.skeletons[0]).toMatchObject({ uri: 'a.ts', language: 'typescript' });
  });

  it('skeleton includes declarations without implementation', async () => {
    const engine = new ContextEngine(makeReader({ 'a.ts': AUTH_SRC }));
    await engine.index(['a.ts']);
    const { skeletons } = await engine.query({ intent: 'auth' });

    const decls = skeletons[0]?.declarations ?? [];
    expect(decls.some((d) => d.name === 'IAuthService')).toBe(true);
    expect(decls.some((d) => d.name === 'AuthService')).toBe(true);
  });
});

describe('ContextEngine.invalidate', () => {
  it('removes file from index', async () => {
    const engine = new ContextEngine(makeReader({ 'a.ts': UTIL_SRC }));
    await engine.index(['a.ts']);
    engine.invalidate(['a.ts']);

    const result = await engine.query({ intent: 'noop' });
    expect(result.skeletons).toHaveLength(0);
  });

  it('is a no-op for uris not in index', () => {
    const engine = new ContextEngine(makeReader({}));
    expect(() => engine.invalidate(['nonexistent.ts'])).not.toThrow();
  });
});

describe('ContextEngine.getProjectMap', () => {
  it('returns all indexed file skeletons', async () => {
    const reader = makeReader({ 'auth.ts': AUTH_SRC, 'db.ts': DB_SRC });
    const engine = new ContextEngine(reader);
    await engine.index(['auth.ts', 'db.ts']);

    const map = await engine.getProjectMap();
    expect(map).toHaveLength(2);
    expect(map.map((s) => s.uri).sort()).toEqual(['auth.ts', 'db.ts']);
  });
});
