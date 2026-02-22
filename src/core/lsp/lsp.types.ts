/**
 * LSP Layer — Type Contracts
 *
 * Interfaces for the TypeScript Language Service adapter used by AI agents.
 * Agents can query diagnostics, type coverage, and symbol exports without
 * spawning a separate tsserver process (in-process Compiler API).
 *
 * @security Read-only. No file mutations.
 */

// ── Diagnostic ────────────────────────────────────────────────────────────────

export interface LspDiagnostic {
  readonly filePath: string;
  readonly line: number;       // 1-based
  readonly character: number;  // 0-based
  readonly message: string;
  readonly code: number;
  readonly category: 'error' | 'warning' | 'suggestion';
}

// ── Type Coverage ─────────────────────────────────────────────────────────────

export interface TypeCoverageResult {
  readonly totalNodes: number;
  readonly anyCount: number;
  /** Percentage of type-annotated nodes that are NOT `any`. 0-100 */
  readonly percentage: number;
}

// ── Export Info ───────────────────────────────────────────────────────────────

export type ExportKind = 'function' | 'class' | 'interface' | 'type' | 'const' | 'other';

export interface ExportInfo {
  readonly name: string;
  readonly filePath: string;
  readonly line: number;  // 1-based
  readonly kind: ExportKind;
}

// ── Service Interface ─────────────────────────────────────────────────────────

export interface ITypeScriptService {
  /**
   * Returns TypeScript diagnostics for a file.
   * @param filePath  Absolute path to .ts file
   * @param sourceOverride  Optional in-memory source (for VFS staged files)
   */
  getDiagnostics(filePath: string, sourceOverride?: string): readonly LspDiagnostic[];

  /**
   * Reports what fraction of type nodes in the given files are NOT `any`.
   */
  getTypeCoverage(filePaths: readonly string[]): TypeCoverageResult;

  /**
   * Locates named exports matching symbolName across the given files.
   */
  findExport(symbolName: string, filePaths: readonly string[]): readonly ExportInfo[];
}
