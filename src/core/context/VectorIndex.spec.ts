/**
 * TFIDFVectorIndex — Unit Tests (Phase 1.2)
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { TFIDFVectorIndex } from './VectorIndex.js';

describe('TFIDFVectorIndex', () => {
  let index: TFIDFVectorIndex;

  beforeEach(() => { index = new TFIDFVectorIndex(); });

  it('starts empty', () => {
    expect(index.size).toBe(0);
  });

  it('upsert increases size', async () => {
    await index.upsert('a', 'a.ts', 'authentication login user');
    expect(index.size).toBe(1);
  });

  it('remove decreases size', async () => {
    await index.upsert('a', 'a.ts', 'login');
    index.remove('a');
    expect(index.size).toBe(0);
  });

  it('search returns empty for empty index', async () => {
    const hits = await index.search('anything');
    expect(hits).toHaveLength(0);
  });

  it('returns relevant doc first', async () => {
    await index.upsert('auth', 'auth.ts', 'login authentication user password token');
    await index.upsert('db',   'db.ts',   'database query sql table rows columns');
    await index.upsert('util', 'util.ts', 'format string number parse');

    const hits = await index.search('login authentication');
    expect(hits[0]?.uri).toBe('auth.ts');
  });

  it('score is between 0 and 1', async () => {
    await index.upsert('a', 'a.ts', 'foo bar baz');
    const hits = await index.search('foo');
    expect(hits[0]?.score).toBeGreaterThan(0);
    expect(hits[0]?.score).toBeLessThanOrEqual(1);
  });

  it('unrelated query returns score 0 docs excluded', async () => {
    await index.upsert('a', 'a.ts', 'authentication service jwt');
    const hits = await index.search('xyzzy qqqq');
    expect(hits).toHaveLength(0);
  });

  it('respects topK', async () => {
    for (let i = 0; i < 10; i++) {
      await index.upsert(`d${i}`, `f${i}.ts`, `login user auth token ${i}`);
    }
    const hits = await index.search('login user', 3);
    expect(hits.length).toBeLessThanOrEqual(3);
  });

  it('upsert with same id updates document', async () => {
    await index.upsert('a', 'a.ts', 'database sql');
    await index.upsert('a', 'a.ts', 'authentication login');
    expect(index.size).toBe(1);
    const hits = await index.search('login');
    expect(hits[0]?.uri).toBe('a.ts');
    const dbHits = await index.search('sql');
    expect(dbHits).toHaveLength(0); // old content gone
  });

  it('results are sorted by score descending', async () => {
    await index.upsert('a', 'a.ts', 'login login login');        // high TF
    await index.upsert('b', 'b.ts', 'login database format');    // low TF
    const hits = await index.search('login');
    expect(hits[0]!.score).toBeGreaterThanOrEqual(hits[1]!.score);
  });
});
