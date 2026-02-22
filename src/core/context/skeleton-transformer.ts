/**
 * skeleton-transformer — AST-guided text replacement
 *
 * Strategy: use TypeScript Compiler API to locate node positions,
 * then splice the original source string. This naturally preserves
 * all comments (including JSDoc) since we never re-print the AST.
 *
 * Processes only top-level and class-level nodes — function bodies
 * are opaque boundaries we don't recurse into.
 */

import ts from 'typescript';
import type { SkeletonOptions } from './SkeletonProvider.types.js';

type Rep = { start: number; end: number; text: string };

const DEFAULT_HIDDEN = '{ /* implementation hidden */ }';

// ── Public API ────────────────────────────────────────────────────────────────

export function skeletonize(source: string, opts: SkeletonOptions = {}): string {
  const hidden = opts.bodyPlaceholder ?? DEFAULT_HIDDEN;
  const sf = ts.createSourceFile('_.ts', source, ts.ScriptTarget.Latest, true);
  const reps: Rep[] = [];

  for (const stmt of sf.statements) {
    processStatement(stmt, sf, reps, hidden, opts.includePrivate ?? false);
  }

  return applyReps(source, reps);
}

// ── Statement dispatcher ──────────────────────────────────────────────────────

function processStatement(
  node: ts.Statement,
  sf: ts.SourceFile,
  reps: Rep[],
  hidden: string,
  includePrivate: boolean
): void {
  if (ts.isFunctionDeclaration(node)) {
    if (node.body) reps.push(rep(node.body, sf, hidden));
    return;
  }

  if (ts.isClassDeclaration(node)) {
    processClass(node, sf, reps, hidden, includePrivate);
    return;
  }

  if (ts.isVariableStatement(node)) {
    processVariableStatement(node, sf, reps, hidden);
    return;
  }

  // ImportDeclaration, InterfaceDeclaration, TypeAliasDeclaration,
  // EnumDeclaration, ExportDeclaration — kept verbatim, no action.
}

// ── Class processing ──────────────────────────────────────────────────────────

function processClass(
  node: ts.ClassDeclaration,
  sf: ts.SourceFile,
  reps: Rep[],
  hidden: string,
  includePrivate: boolean
): void {
  for (const member of node.members) {
    if (!includePrivate && isPrivateMember(member)) {
      reps.push({ start: member.getFullStart(), end: member.getEnd(), text: '' });
      continue;
    }
    hideMemberBody(member, sf, reps, hidden);
  }
}

function hideMemberBody(
  member: ts.ClassElement,
  sf: ts.SourceFile,
  reps: Rep[],
  hidden: string
): void {
  if (
    ts.isMethodDeclaration(member) ||
    ts.isConstructorDeclaration(member) ||
    ts.isGetAccessorDeclaration(member) ||
    ts.isSetAccessorDeclaration(member)
  ) {
    if (member.body) reps.push(rep(member.body, sf, hidden));
    return;
  }

  if (ts.isPropertyDeclaration(member) && member.initializer) {
    hideArrowBody(member.initializer, sf, reps, hidden);
  }
}

// ── Variable statements with arrow functions ──────────────────────────────────

function processVariableStatement(
  node: ts.VariableStatement,
  sf: ts.SourceFile,
  reps: Rep[],
  hidden: string
): void {
  for (const decl of node.declarationList.declarations) {
    if (!decl.initializer) continue;
    hideArrowBody(decl.initializer, sf, reps, hidden);
  }
}

function hideArrowBody(
  expr: ts.Expression,
  sf: ts.SourceFile,
  reps: Rep[],
  hidden: string
): void {
  if (ts.isArrowFunction(expr)) {
    // Block body `() => { ... }` OR expression body `() => expr`
    reps.push({ start: expr.body.getStart(sf), end: expr.body.getEnd(), text: hidden });
  } else if (ts.isFunctionExpression(expr) && expr.body) {
    reps.push(rep(expr.body, sf, hidden));
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function rep(body: ts.Block, sf: ts.SourceFile, text: string): Rep {
  return { start: body.getStart(sf), end: body.getEnd(), text };
}

function isPrivateMember(member: ts.ClassElement): boolean {
  if (member.name && ts.isPrivateIdentifier(member.name)) return true;
  if (!ts.canHaveModifiers(member)) return false;
  return (ts.getModifiers(member) ?? []).some(
    (m) =>
      m.kind === ts.SyntaxKind.PrivateKeyword ||
      m.kind === ts.SyntaxKind.ProtectedKeyword
  );
}

function applyReps(source: string, reps: Rep[]): string {
  const sorted = [...reps].sort((a, b) => b.start - a.start);
  let result = source;
  for (const r of sorted) {
    result = result.slice(0, r.start) + r.text + result.slice(r.end);
  }
  return result;
}
