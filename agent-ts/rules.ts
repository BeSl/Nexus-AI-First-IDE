/**
 * AgentTS — NEXUS Rule Implementations (NEXUS-001 … NEXUS-008)
 *
 * Line-based rules use regex — fast, no dependencies.
 * AST-based rules use TypeScript Compiler API for structural checks.
 *
 * @security All rules are read-only. Pure functions over strings.
 */

import ts from 'typescript';
import type { NexusRule, LintViolation } from './rules.types.js';

// ── Line-based rules ──────────────────────────────────────────────────────────

export const NEXUS_001: NexusRule = {
  id: 'NEXUS-001', severity: 'critical',
  description: 'No implicit or explicit `any` type',
  checkLines(lines, file) {
    return matchLines(lines, file, /(?::\s*any\b|as\s+any\b)/, 'NEXUS-001', 'critical',
      'Implicit any detected.', 'Replace with an explicit TypeScript type.');
  },
};

export const NEXUS_002: NexusRule = {
  id: 'NEXUS-002', severity: 'critical',
  description: 'No hardcoded secrets (API keys, passwords)',
  checkLines(lines, file) {
    return matchLines(lines, file,
      /(?:apiKey|api_key|password|secret|token|privateKey)\s*=\s*['"`][^'"`\s]{6,}/,
      'NEXUS-002', 'critical',
      'Possible hardcoded secret.', 'Use environment variables or a secrets manager.');
  },
};

export const NEXUS_003: NexusRule = {
  id: 'NEXUS-003', severity: 'critical',
  description: 'No direct fs.readFileSync / fs.writeFileSync',
  checkLines(lines, file) {
    return matchLines(lines, file, /fs\.(readFileSync|writeFileSync|appendFileSync)\s*\(/,
      'NEXUS-003', 'critical',
      'Direct fs access detected.', 'Use IFileReader or IVirtualFileSystem instead.');
  },
};

export const NEXUS_005: NexusRule = {
  id: 'NEXUS-005', severity: 'warning',
  description: 'Max file length: 150 lines',
  checkLines(lines, file) {
    if (lines.length <= 150) return [];
    return [{ rule: 'NEXUS-005', severity: 'warning', file, line: 0,
      message: `File has ${lines.length} lines (max 150).`,
      suggestion: 'Split into smaller modules.' }];
  },
};

export const NEXUS_006: NexusRule = {
  id: 'NEXUS-006', severity: 'warning',
  description: 'Private class fields must use # prefix, not _',
  checkLines(lines, file) {
    return matchLines(lines, file, /\bprivate\s+_[a-zA-Z]/,
      'NEXUS-006', 'warning',
      'Private field uses underscore convention.', "Use '#field' syntax instead of '_field'.");
  },
};

export const NEXUS_007: NexusRule = {
  id: 'NEXUS-007', severity: 'info',
  description: 'No console.log in production code',
  checkLines(lines, file) {
    return matchLines(lines, file, /console\.log\s*\(/,
      'NEXUS-007', 'info',
      'console.log found.', 'Use a structured logger instead.');
  },
};

// ── AST-based rules ───────────────────────────────────────────────────────────

export const NEXUS_004: NexusRule = {
  id: 'NEXUS-004', severity: 'warning',
  description: 'Exported functions and classes must have JSDoc',
  checkAST(source, file) {
    const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
    const violations: LintViolation[] = [];
    for (const stmt of sf.statements) {
      if (!isExported(stmt)) continue;
      if (!isFunctionOrClass(stmt)) continue;
      const jsDoc = (stmt as unknown as { jsDoc?: unknown[] }).jsDoc;
      if (!jsDoc || jsDoc.length === 0) {
        const { line } = sf.getLineAndCharacterOfPosition(stmt.getStart(sf));
        const name = getNodeName(stmt) ?? '(anonymous)';
        violations.push({ rule: 'NEXUS-004', severity: 'warning', file, line: line + 1,
          message: `Exported '${name}' is missing JSDoc.`,
          suggestion: 'Add /** ... */ block above the declaration.' });
      }
    }
    return violations;
  },
};

export const NEXUS_008: NexusRule = {
  id: 'NEXUS-008', severity: 'info',
  description: 'Exported classes must implement a named interface',
  checkAST(source, file) {
    const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
    const violations: LintViolation[] = [];
    for (const stmt of sf.statements) {
      if (!isExported(stmt) || stmt.kind !== ts.SyntaxKind.ClassDeclaration) continue;
      const cls = stmt as ts.ClassDeclaration;
      const hasImplements = cls.heritageClauses?.some(
        (h) => h.token === ts.SyntaxKind.ImplementsKeyword,
      );
      if (!hasImplements) {
        const { line } = sf.getLineAndCharacterOfPosition(stmt.getStart(sf));
        const name = cls.name?.text ?? '(anonymous)';
        violations.push({ rule: 'NEXUS-008', severity: 'info', file, line: line + 1,
          message: `Class '${name}' does not implement a named interface.`,
          suggestion: `Add 'implements I${name}' or a relevant interface.` });
      }
    }
    return violations;
  },
};

export const ALL_RULES: readonly NexusRule[] =
  [NEXUS_001, NEXUS_002, NEXUS_003, NEXUS_004, NEXUS_005, NEXUS_006, NEXUS_007, NEXUS_008];

// ── Helpers ───────────────────────────────────────────────────────────────────

function matchLines(
  lines: readonly string[], file: string, re: RegExp,
  rule: string, severity: LintViolation['severity'],
  message: string, suggestion: string,
): LintViolation[] {
  const violations: LintViolation[] = [];
  lines.forEach((l, i) => {
    if (re.test(l)) violations.push({ rule, severity, file, line: i + 1, message, suggestion });
  });
  return violations;
}

function isExported(node: ts.Node): boolean {
  return ts.canHaveModifiers(node) &&
    (ts.getModifiers(node) ?? []).some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
}

function isFunctionOrClass(node: ts.Node): boolean {
  return node.kind === ts.SyntaxKind.FunctionDeclaration ||
    node.kind === ts.SyntaxKind.ClassDeclaration;
}

function getNodeName(node: ts.Node): string | undefined {
  return (node as unknown as { name?: { text: string } }).name?.text;
}
