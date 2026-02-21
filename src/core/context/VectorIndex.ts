/**
 * TFIDFVectorIndex — Phase 1 Vector Index
 *
 * Computes TF-IDF vectors and cosine similarity in-memory.
 * No external dependencies, no API key required.
 *
 * Swap this for AnthropicEmbeddingIndex in Phase 2 —
 * the IVectorIndex interface stays the same.
 *
 * @security Read-only after upsert. No network calls.
 */

import type { IVectorIndex, IndexedDoc, SearchHit } from './VectorIndex.types.js';

export class TFIDFVectorIndex implements IVectorIndex {
  readonly #docs = new Map<string, IndexedDoc>();
  /** Document frequency: term → count of docs containing it */
  #df = new Map<string, number>();
  #dirty = false;

  get size(): number { return this.#docs.size; }

  async upsert(id: string, uri: string, content: string): Promise<void> {
    if (this.#docs.has(id)) {
      // Remove old DF contributions
      const old = this.#docs.get(id)!;
      this.#removeDF(termSet(old.content));
    }
    const terms = termSet(content);
    this.#addDF(terms);
    // Placeholder vector — rebuilt lazily on search
    this.#docs.set(id, { id, uri, content, vector: [] });
    this.#dirty = true;
  }

  remove(id: string): void {
    const doc = this.#docs.get(id);
    if (!doc) return;
    this.#removeDF(termSet(doc.content));
    this.#docs.delete(id);
    this.#dirty = true;
  }

  async search(query: string, topK = 5): Promise<readonly SearchHit[]> {
    if (this.#docs.size === 0) return [];
    if (this.#dirty) this.#rebuild();

    const qVec = this.#tfidf(tokenize(query));
    const results: SearchHit[] = [];

    for (const doc of this.#docs.values()) {
      const score = cosine(qVec, doc.vector as number[]);
      if (score > 0) results.push({ id: doc.id, uri: doc.uri, score, content: doc.content });
    }

    return results.sort((a, b) => b.score - a.score).slice(0, topK);
  }

  // ── Private ─────────────────────────────────────────────────────────────────

  #rebuild(): void {
    for (const [id, doc] of this.#docs) {
      const vec = this.#tfidf(tokenize(doc.content));
      this.#docs.set(id, { ...doc, vector: vec });
    }
    this.#dirty = false;
  }

  #tfidf(terms: string[]): number[] {
    const tf = termFreq(terms);
    const N = this.#docs.size || 1;
    const vocab = [...this.#df.keys()];
    return vocab.map((t) => {
      const tfVal = tf.get(t) ?? 0;
      const df = this.#df.get(t) ?? 1;
      // Smoothed IDF: log((N+1)/(df+1)) + 1  ← avoids log(1)=0 for universal terms
      return tfVal * (Math.log((N + 1) / (df + 1)) + 1);
    });
  }

  #addDF(terms: Set<string>): void {
    for (const t of terms) this.#df.set(t, (this.#df.get(t) ?? 0) + 1);
  }

  #removeDF(terms: Set<string>): void {
    for (const t of terms) {
      const n = (this.#df.get(t) ?? 1) - 1;
      if (n <= 0) this.#df.delete(t); else this.#df.set(t, n);
    }
  }
}

// ── Pure math helpers ──────────────────────────────────────────────────────────

function tokenize(text: string): string[] {
  return text.toLowerCase().match(/[a-z][a-z0-9]*/g) ?? [];
}

function termSet(text: string): Set<string> {
  return new Set(tokenize(text));
}

function termFreq(terms: string[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const t of terms) map.set(t, (map.get(t) ?? 0) + 1 / terms.length);
  return map;
}

function cosine(a: number[], b: number[]): number {
  let dot = 0, na = 0, nb = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    dot += a[i]! * b[i]!;
    na += a[i]! ** 2;
    nb += b[i]! ** 2;
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom === 0 ? 0 : dot / denom;
}
