/**
 * AgentToolkit — Unit Tests
 * All services are mocked — no real FS or API calls.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AgentToolkit } from './AgentToolkit.js';
import type { IContextEngine } from '../../../core/context-engine.types.js';
import type { IVectorIndex } from '../context/VectorIndex.types.js';
import type { ISkeletonProvider } from '../context/SkeletonProvider.types.js';

// ── Mocks ─────────────────────────────────────────────────────────────────────

function makeCtx(): IContextEngine {
  return {
    query: vi.fn().mockResolvedValue({
      query: { intent: 'test' },
      skeletons: [{ uri: 'src/foo.ts', tokenCount: 100, declarations: [], imports: [], language: 'ts' }],
      ragChunks: [],
      totalTokens: 100,
    }),
    index: vi.fn(),
    invalidate: vi.fn(),
  };
}

function makeVec(): IVectorIndex {
  return {
    upsert: vi.fn(),
    remove: vi.fn(),
    search: vi.fn().mockResolvedValue([
      { id: 'a', uri: 'src/a.ts', score: 0.9, content: 'export class Foo {}' },
    ]),
    size: 1,
  };
}

function makeSkel(): ISkeletonProvider {
  return {
    fromContent: vi.fn().mockReturnValue({
      uri: 'input.ts',
      skeleton: 'export class Foo { /* hidden */ }',
      originalSize: 100,
      skeletonSize: 30,
      compressionRatio: 0.3,
      declarations: [],
    }),
    fromFile: vi.fn(),
    fromDirectory: vi.fn(),
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('AgentToolkit.getTools', () => {
  it('returns 3 MCP tools', () => {
    const tk = new AgentToolkit(makeCtx(), makeVec(), makeSkel());
    expect(tk.getTools()).toHaveLength(3);
    const names = tk.getTools().map((t) => t.name);
    expect(names).toContain('context_query');
    expect(names).toContain('vector_search');
    expect(names).toContain('read_skeleton');
  });

  it('all tools have inputSchema with required array', () => {
    const tk = new AgentToolkit(makeCtx(), makeVec(), makeSkel());
    for (const tool of tk.getTools()) {
      expect(tool.inputSchema).toBeDefined();
    }
  });
});

describe('AgentToolkit.dispatch — context_query', () => {
  let ctx: IContextEngine; let tk: AgentToolkit;
  beforeEach(() => { ctx = makeCtx(); tk = new AgentToolkit(ctx, makeVec(), makeSkel()); });

  it('calls contextEngine.query with intent', async () => {
    await tk.dispatch('context_query', { intent: 'find auth logic' });
    expect(ctx.query).toHaveBeenCalledWith(expect.objectContaining({ intent: 'find auth logic' }));
  });

  it('returns isError:false and JSON content', async () => {
    const result = await tk.dispatch('context_query', { intent: 'x' });
    expect(result.isError).toBe(false);
    expect(() => JSON.parse(result.content)).not.toThrow();
  });

  it('passes scope and topK through', async () => {
    await tk.dispatch('context_query', { intent: 'x', scope: ['src/auth'], topK: 3 });
    expect(ctx.query).toHaveBeenCalledWith(expect.objectContaining({ scope: ['src/auth'], topK: 3 }));
  });
});

describe('AgentToolkit.dispatch — vector_search', () => {
  it('calls vectorIndex.search with query', async () => {
    const vec = makeVec();
    const tk = new AgentToolkit(makeCtx(), vec, makeSkel());
    await tk.dispatch('vector_search', { query: 'AuthService login' });
    expect(vec.search).toHaveBeenCalledWith('AuthService login', 5);
  });

  it('returns serialized hits', async () => {
    const tk = new AgentToolkit(makeCtx(), makeVec(), makeSkel());
    const result = await tk.dispatch('vector_search', { query: 'foo' });
    const data = JSON.parse(result.content) as unknown[];
    expect(Array.isArray(data)).toBe(true);
    expect(data).toHaveLength(1);
  });
});

describe('AgentToolkit.dispatch — read_skeleton', () => {
  it('calls skeletonProvider.fromContent', async () => {
    const skel = makeSkel();
    const tk = new AgentToolkit(makeCtx(), makeVec(), skel);
    await tk.dispatch('read_skeleton', { source: 'export class X {}', fileName: 'x.ts' });
    expect(skel.fromContent).toHaveBeenCalledWith('export class X {}', 'x.ts');
  });

  it('result contains skeleton and compressionRatio', async () => {
    const tk = new AgentToolkit(makeCtx(), makeVec(), makeSkel());
    const result = await tk.dispatch('read_skeleton', { source: 'export class X {}' });
    const data = JSON.parse(result.content) as { skeleton: string; compressionRatio: number };
    expect(data.skeleton).toBeDefined();
    expect(data.compressionRatio).toBe(0.3);
  });
});

describe('AgentToolkit.dispatch — error handling', () => {
  it('returns isError:true for unknown tool', async () => {
    const tk = new AgentToolkit(makeCtx(), makeVec(), makeSkel());
    const result = await tk.dispatch('not_a_tool', {});
    expect(result.isError).toBe(true);
    expect(JSON.parse(result.content)).toHaveProperty('error');
  });

  it('catches thrown errors and returns isError:true', async () => {
    const vec = makeVec();
    (vec.search as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('index offline'));
    const tk = new AgentToolkit(makeCtx(), vec, makeSkel());
    const result = await tk.dispatch('vector_search', { query: 'x' });
    expect(result.isError).toBe(true);
    expect(JSON.parse(result.content)).toMatchObject({ error: 'index offline' });
  });
});
