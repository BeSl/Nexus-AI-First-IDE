/**
 * SkeletonProvider — File & Directory wrapper around skeleton-transformer.
 *
 * Reads TypeScript files and returns LLM-ready skeletons.
 * Used by ContextEngine.query() to compress code before sending to agents.
 *
 * @security Read-only. No writes to disk.
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, extname, basename } from 'path';
import ts from 'typescript';
import { skeletonize } from './skeleton-transformer.js';
import type {
  ISkeletonProvider,
  SkeletonOptions,
  SkeletonResult,
  DeclarationSummary,
} from './SkeletonProvider.types.js';

export class SkeletonProvider implements ISkeletonProvider {
  fromContent(
    content: string,
    fileName = 'virtual.ts',
    opts: SkeletonOptions = {}
  ): SkeletonResult {
    const skeleton = skeletonize(content, opts);
    return {
      uri: fileName,
      skeleton,
      originalSize: content.length,
      skeletonSize: skeleton.length,
      compressionRatio: skeleton.length / Math.max(content.length, 1),
      declarations: extractDeclarations(content, fileName),
    };
  }

  async fromFile(filePath: string, opts: SkeletonOptions = {}): Promise<SkeletonResult> {
    const content = readFileSync(filePath, 'utf-8');
    return this.fromContent(content, filePath, opts);
  }

  async fromDirectory(
    dirPath: string,
    opts: SkeletonOptions & { recursive?: boolean } = {}
  ): Promise<Map<string, SkeletonResult>> {
    const files = collectTsFiles(dirPath, opts.recursive ?? false);
    const results = new Map<string, SkeletonResult>();

    for (const filePath of files) {
      results.set(filePath, await this.fromFile(filePath, opts));
    }

    return results;
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function collectTsFiles(dir: string, recursive: boolean): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory() && recursive) {
      files.push(...collectTsFiles(full, true));
    } else if (stat.isFile() && /\.tsx?$/.test(extname(entry)) && !entry.endsWith('.spec.ts') && !entry.endsWith('.d.ts')) {
      files.push(full);
    }
  }
  return files;
}

function extractDeclarations(source: string, fileName: string): readonly DeclarationSummary[] {
  const sf = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true);
  const result: DeclarationSummary[] = [];

  for (const stmt of sf.statements) {
    const exported = isExported(stmt);

    if (ts.isImportDeclaration(stmt)) {
      result.push({ kind: 'import', name: getModuleSpecifier(stmt), exported: false });
    } else if (ts.isFunctionDeclaration(stmt) && stmt.name) {
      result.push({ kind: 'function', name: stmt.name.text, exported });
    } else if (ts.isClassDeclaration(stmt) && stmt.name) {
      result.push({ kind: 'class', name: stmt.name.text, exported });
    } else if (ts.isInterfaceDeclaration(stmt)) {
      result.push({ kind: 'interface', name: stmt.name.text, exported });
    } else if (ts.isTypeAliasDeclaration(stmt)) {
      result.push({ kind: 'type', name: stmt.name.text, exported });
    } else if (ts.isEnumDeclaration(stmt)) {
      result.push({ kind: 'enum', name: stmt.name.text, exported });
    } else if (ts.isVariableStatement(stmt)) {
      for (const decl of stmt.declarationList.declarations) {
        if (ts.isIdentifier(decl.name)) {
          result.push({ kind: 'variable', name: decl.name.text, exported });
        }
      }
    }
  }

  return result;
}

function isExported(node: ts.Statement): boolean {
  return (ts.getModifiers(node as ts.HasModifiers) ?? []).some(
    (m) => m.kind === ts.SyntaxKind.ExportKeyword
  );
}

function getModuleSpecifier(node: ts.ImportDeclaration): string {
  return ts.isStringLiteral(node.moduleSpecifier) ? node.moduleSpecifier.text : '?';
}
