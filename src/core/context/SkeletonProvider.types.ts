/**
 * SkeletonProvider — Type Contracts
 *
 * Generates an LLM-optimized "skeleton" of TypeScript source:
 * public API surface only, all implementation bodies hidden.
 * Used by ContextEngine to minimize token usage before agent queries.
 */

export interface SkeletonOptions {
  /** Include private/protected class members (default: false) */
  readonly includePrivate?: boolean;
  /** Text to fill hidden bodies (default: '{ /‌* implementation hidden *‌/ }') */
  readonly bodyPlaceholder?: string;
}

/** A named declaration found in the source */
export interface DeclarationSummary {
  readonly kind: 'function' | 'class' | 'interface' | 'type' | 'import' | 'enum' | 'variable';
  readonly name: string;
  readonly exported: boolean;
}

/** Result returned by SkeletonProvider */
export interface SkeletonResult {
  readonly uri: string;
  /** Transformed TypeScript source — signatures only */
  readonly skeleton: string;
  readonly originalSize: number;
  readonly skeletonSize: number;
  /** Ratio skeletonSize/originalSize — lower means more was hidden */
  readonly compressionRatio: number;
  readonly declarations: readonly DeclarationSummary[];
}

export interface ISkeletonProvider {
  /** Transform raw TypeScript source into a skeleton */
  fromContent(content: string, fileName?: string, opts?: SkeletonOptions): SkeletonResult;
  /** Read a file from disk and skeletonize it */
  fromFile(filePath: string, opts?: SkeletonOptions): Promise<SkeletonResult>;
  /** Skeletonize all .ts files in a directory (non-recursive by default) */
  fromDirectory(
    dirPath: string,
    opts?: SkeletonOptions & { recursive?: boolean }
  ): Promise<Map<string, SkeletonResult>>;
}
