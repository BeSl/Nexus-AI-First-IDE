/**
 * ContextEngine — IContextEngine Implementation (Phase 1)
 *
 * Wires SkeletonProvider into the agent query pipeline.
 * Phase 1: keyword-relevance ranking + token-budget gating.
 * Phase 2 (TODO): replace keyword scoring with real vector embeddings.
 *
 * Ranking priority (per SYSTEM_OVERVIEW):
 *   1. Files matching scope pattern
 *   2. Files whose skeleton contains the most intent keywords
 *   3. Capped by maxTokens budget
 *
 * @security Read-only. Zero writes to disk or VFS.
 */

import { SkeletonProvider } from './SkeletonProvider.js';
import type { SkeletonResult } from './SkeletonProvider.types.js';
import type {
  IContextEngine,
  ContextQuery,
  ContextResult,
  FileSkeleton,
  Declaration,
} from '../../../core/context-engine.types.js';

/** Minimal read interface — real FS, VFS, or in-memory stub can implement this */
export interface IFileReader {
  read(uri: string): Promise<string>;
}

type IndexEntry = { skeleton: SkeletonResult; words: Set<string> };
type DeclKind = Declaration['kind'];

const KIND_MAP: Partial<Record<string, DeclKind>> = {
  function: 'function', class: 'class', interface: 'interface',
  type: 'type', enum: 'enum', variable: 'const',
};

// ── ContextEngine ─────────────────────────────────────────────────────────────

export class ContextEngine implements IContextEngine {
  readonly #reader: IFileReader;
  readonly #skeletons = new SkeletonProvider();
  readonly #index = new Map<string, IndexEntry>();

  constructor(reader: IFileReader) {
    this.#reader = reader;
  }

  async query(q: ContextQuery): Promise<ContextResult> {
    const keywords = tokenize(q.intent);
    const topK = q.topK ?? 10;
    const budget = q.maxTokens ?? Infinity;

    // 1. Filter by scope (Phase 1: substring; Phase 2: minimatch glob)
    let uris = [...this.#index.keys()];
    if (q.scope?.length) {
      uris = uris.filter((uri) =>
        q.scope!.some((p) => uri.includes(p) || uri.endsWith(p))
      );
    }

    // 2. Rank by keyword overlap with intent
    const ranked = uris
      .map((uri) => ({ uri, score: overlap(keywords, this.#index.get(uri)!.words) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);

    // 3. Fill token budget greedily
    let spent = 0;
    const skeletons: FileSkeleton[] = [];
    for (const { uri } of ranked) {
      const { skeleton } = this.#index.get(uri)!;
      const cost = approxTokens(skeleton.skeletonSize);
      if (spent + cost > budget) break;
      spent += cost;
      skeletons.push(toFileSkeleton(skeleton));
    }

    return { query: q, skeletons, ragChunks: [], totalTokens: spent };
  }

  async index(uris: readonly string[]): Promise<void> {
    for (const uri of uris) {
      const content = await this.#reader.read(uri);
      const skeleton = this.#skeletons.fromContent(content, uri);
      this.#index.set(uri, { skeleton, words: tokenize(skeleton.skeleton) });
    }
  }

  invalidate(uris: readonly string[]): void {
    for (const uri of uris) this.#index.delete(uri);
  }

  /** Returns skeletons for all indexed files (for project-wide views) */
  async getProjectMap(): Promise<FileSkeleton[]> {
    return [...this.#index.values()].map((e) => toFileSkeleton(e.skeleton));
  }
}

// ── Pure helpers ──────────────────────────────────────────────────────────────

function tokenize(text: string): Set<string> {
  return new Set(text.toLowerCase().match(/[a-z][a-z0-9]*/g) ?? []);
}

function overlap(a: Set<string>, b: Set<string>): number {
  let n = 0;
  for (const w of a) if (b.has(w)) n++;
  return n;
}

function approxTokens(chars: number): number {
  return Math.ceil(chars / 4);
}

function toFileSkeleton(r: SkeletonResult): FileSkeleton {
  return {
    uri: r.uri,
    language: 'typescript',
    imports: r.declarations.filter((d) => d.kind === 'import').map((d) => d.name),
    declarations: r.declarations
      .filter((d) => d.kind !== 'import')
      .map((d) => ({
        kind: KIND_MAP[d.kind] ?? 'const',
        name: d.name,
        exported: d.exported,
        signature: d.name,
      })),
    tokenCount: approxTokens(r.skeletonSize),
  };
}
