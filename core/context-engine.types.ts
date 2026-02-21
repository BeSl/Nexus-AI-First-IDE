/**
 * Context Engine (The Brain) — Type Contracts
 *
 * Filters raw code into LLM-ready "skeletons", manages RAG vector search.
 * RULE: Agents NEVER read files directly — all data flows through ContextEngine.query()
 *
 * @security Queries are read-only. Mutation only via VFS, never directly.
 */

/** A compressed, LLM-optimized view of a file (no implementation bodies) */
export interface FileSkeleton {
  readonly uri: string;
  readonly language: string;
  /** Interface/type declarations only — no function bodies */
  readonly declarations: readonly Declaration[];
  /** Import graph edges */
  readonly imports: readonly string[];
  readonly tokenCount: number;
}

export interface Declaration {
  readonly kind: 'interface' | 'type' | 'class' | 'function' | 'enum' | 'const';
  readonly name: string;
  readonly exported: boolean;
  readonly signature: string;
  readonly jsdoc?: string;
}

/** A semantic chunk stored in the vector index */
export interface VectorChunk {
  readonly id: string;
  readonly uri: string;
  readonly content: string;
  readonly embedding: readonly number[];
  readonly score?: number;
}

/** Query input to the Context Engine */
export interface ContextQuery {
  /** Natural-language or structured query */
  readonly intent: string;
  /** Restrict search to specific file globs */
  readonly scope?: readonly string[];
  /** Max token budget for response */
  readonly maxTokens?: number;
  /** Number of RAG chunks to retrieve */
  readonly topK?: number;
}

/** Aggregated context returned to an agent */
export interface ContextResult {
  readonly query: ContextQuery;
  readonly skeletons: readonly FileSkeleton[];
  readonly ragChunks: readonly VectorChunk[];
  readonly totalTokens: number;
}

export interface IContextEngine {
  /**
   * Primary entry point for all agent data requests.
   * @security Read-only. Cannot trigger file writes.
   */
  query(q: ContextQuery): Promise<ContextResult>;

  /** Rebuild vector index for a set of URIs */
  index(uris: readonly string[]): Promise<void>;

  /** Invalidate cached skeletons when files change */
  invalidate(uris: readonly string[]): void;
}
