/**
 * TypeScriptService — in-process TypeScript Compiler API adapter
 *
 * Provides diagnostics, type coverage, and export lookup for AI agents
 * without spawning a separate tsserver. Uses ts.createProgram each call
 * (stateless, no caching) to keep implementation simple and testable.
 *
 * @security Read-only. Never writes to disk or VFS.
 */

import * as ts from 'typescript';
import type {
  ITypeScriptService,
  LspDiagnostic,
  TypeCoverageResult,
  ExportInfo,
  ExportKind,
} from './lsp.types.js';

// ── Category map ──────────────────────────────────────────────────────────────

const CATEGORY: Record<ts.DiagnosticCategory, LspDiagnostic['category']> = {
  [ts.DiagnosticCategory.Error]:       'error',
  [ts.DiagnosticCategory.Warning]:     'warning',
  [ts.DiagnosticCategory.Suggestion]:  'suggestion',
  [ts.DiagnosticCategory.Message]:     'suggestion',
};

// ── Implementation ────────────────────────────────────────────────────────────

export class TypeScriptService implements ITypeScriptService {

  /** @security sourceOverride keeps staged code in memory — never touches FS */
  getDiagnostics(filePath: string, sourceOverride?: string): readonly LspDiagnostic[] {
    const host = sourceOverride
      ? this.#hostWithOverride(filePath, sourceOverride)
      : ts.createCompilerHost({});

    const program = ts.createProgram([filePath], { strict: true, noEmit: true }, host);
    const sourceFile = program.getSourceFile(filePath);
    if (!sourceFile) return [];

    const diags = [
      ...program.getSyntacticDiagnostics(sourceFile),
      ...program.getSemanticDiagnostics(sourceFile),
    ];

    return diags.flatMap((d) => this.#mapDiagnostic(d, filePath));
  }

  getTypeCoverage(filePaths: readonly string[]): TypeCoverageResult {
    const program = ts.createProgram([...filePaths], { strict: true, noEmit: true });
    let totalNodes = 0;
    let anyCount = 0;

    for (const filePath of filePaths) {
      const sf = program.getSourceFile(filePath);
      if (!sf) continue;
      this.#walkTypeNodes(sf, (node) => {
        totalNodes++;
        if (ts.isTypeReferenceNode(node) && ts.isIdentifier(node.typeName) && node.typeName.text === 'any') anyCount++;
        if (node.kind === ts.SyntaxKind.AnyKeyword) anyCount++;
      });
    }

    const percentage = totalNodes === 0 ? 100 : Math.round(((totalNodes - anyCount) / totalNodes) * 100);
    return { totalNodes, anyCount, percentage };
  }

  findExport(symbolName: string, filePaths: readonly string[]): readonly ExportInfo[] {
    const results: ExportInfo[] = [];
    const program = ts.createProgram([...filePaths], { noEmit: true });

    for (const filePath of filePaths) {
      const sf = program.getSourceFile(filePath);
      if (!sf) continue;
      this.#collectExports(sf, filePath, symbolName, results);
    }
    return results;
  }

  // ── Private helpers ──────────────────────────────────────────────────────────

  #hostWithOverride(filePath: string, source: string): ts.CompilerHost {
    const base = ts.createCompilerHost({});
    return {
      ...base,
      getSourceFile(name, langVersion, _onError, _shouldCreate) {
        if (name === filePath) return ts.createSourceFile(name, source, langVersion, true);
        return base.getSourceFile(name, langVersion, _onError, _shouldCreate);
      },
      fileExists(name) { return name === filePath || base.fileExists(name); },
      readFile(name)   { return name === filePath ? source : base.readFile(name); },
    };
  }

  #mapDiagnostic(d: ts.Diagnostic, fallbackPath: string): LspDiagnostic[] {
    if (!d.file || d.start === undefined) return [];
    const { line, character } = d.file.getLineAndCharacterOfPosition(d.start);
    return [{
      filePath:  d.file.fileName ?? fallbackPath,
      line:      line + 1,
      character,
      message:   ts.flattenDiagnosticMessageText(d.messageText, '\n'),
      code:      d.code,
      category:  CATEGORY[d.category] ?? 'suggestion',
    }];
  }

  #walkTypeNodes(node: ts.Node, visitor: (n: ts.TypeNode) => void): void {
    if (ts.isTypeNode(node)) visitor(node as ts.TypeNode);
    ts.forEachChild(node, (child) => this.#walkTypeNodes(child, visitor));
  }

  #collectExports(
    sf: ts.SourceFile,
    filePath: string,
    symbolName: string,
    out: ExportInfo[],
  ): void {
    for (const stmt of sf.statements) {
      if (!hasExportModifier(stmt)) continue;
      const info = extractExportInfo(stmt, filePath, sf, symbolName);
      if (info) out.push(info);
    }
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function hasExportModifier(node: ts.Node): boolean {
  if (!ts.canHaveModifiers(node)) return false;
  return (ts.getModifiers(node) ?? []).some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
}

function extractExportInfo(
  stmt: ts.Statement,
  filePath: string,
  sf: ts.SourceFile,
  symbolName: string,
): ExportInfo | null {
  let name: string | null = null;
  let kind: ExportKind = 'other';

  if (ts.isFunctionDeclaration(stmt) || ts.isFunctionLike(stmt)) {
    name = (stmt as ts.FunctionDeclaration).name?.text ?? null;
    kind = 'function';
  } else if (ts.isClassDeclaration(stmt)) {
    name = stmt.name?.text ?? null;
    kind = 'class';
  } else if (ts.isInterfaceDeclaration(stmt)) {
    name = stmt.name.text;
    kind = 'interface';
  } else if (ts.isTypeAliasDeclaration(stmt)) {
    name = stmt.name.text;
    kind = 'type';
  } else if (ts.isVariableStatement(stmt)) {
    const decl = stmt.declarationList.declarations[0];
    name = decl && ts.isIdentifier(decl.name) ? decl.name.text : null;
    kind = 'const';
  }

  if (!name || name !== symbolName) return null;
  const { line } = sf.getLineAndCharacterOfPosition(stmt.pos);
  return { name, filePath, line: line + 1, kind };
}
