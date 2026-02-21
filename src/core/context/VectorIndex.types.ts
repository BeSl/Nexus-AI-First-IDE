/**
 * VectorIndex — Type Contracts
 *
 * Phase 1: TF-IDF cosine similarity (no external deps, no API key).
 * Phase 2: swap IVectorIndex impl for real embeddings (Anthropic / OpenAI).
 * The interface is stable — callers don't change between phases.
 */

export interface IndexedDoc {
  readonly id: string;
  readonly uri: string;
  readonly content: string;
  /** TF-IDF vector (Phase 1) or dense embedding (Phase 2) */
  readonly vector: readonly number[];
}

export interface SearchHit {
  readonly id: string;
  readonly uri: string;
  readonly score: number;   // cosine similarity [0..1]
  readonly content: string;
}

export interface IVectorIndex {
  /** Add or update a document */
  upsert(id: string, uri: string, content: string): Promise<void>;
  /** Remove a document */
  remove(id: string): void;
  /** Find topK most similar documents to query */
  search(query: string, topK?: number): Promise<readonly SearchHit[]>;
  /** Number of indexed documents */
  readonly size: number;
}
