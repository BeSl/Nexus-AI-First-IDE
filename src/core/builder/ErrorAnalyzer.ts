/**
 * ErrorAnalyzer — Build Error Parser + Auto-Fix Suggester
 *
 * Parses TypeScript compiler output and common build tool formats.
 * Suggests patches for well-known error patterns without calling an LLM.
 * For unknown errors, returns a low-confidence explanation stub.
 *
 * @security Reads shadow dir files only. Cannot write anything.
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import type {
  IErrorAnalyzer,
  BuildError,
  SuggestedFix,
  FilePatch,
} from './BuildOrchestrator.types.js';

// ── Regex patterns for common build tools ────────────────────────────────────

/** tsc: src/foo.ts(12,5): error TS2345: Argument... */
const TSC_PATTERN =
  /^(.+?)\((\d+),(\d+)\):\s+(error|warning)\s+(TS\d+)?:?\s*(.+)$/gm;

/** esbuild / vite: src/foo.ts:12:5: error: ... */
const ESBUILD_PATTERN =
  /^(.+?):(\d+):(\d+):\s+(error|warning):\s+(.+)$/gm;

// ── Known auto-fixable TS error codes ────────────────────────────────────────

const KNOWN_FIXES: Record<
  string,
  (err: BuildError, src: string) => string | null
> = {
  /** TS2307: Cannot find module 'X' — add .js extension for ESM */
  TS2307: (err, src) => {
    const match = /Cannot find module '(.+)'/.exec(err.message);
    if (!match?.[1]) return null;
    const mod = match[1];
    if (!mod.startsWith('.') || mod.endsWith('.js')) return null;
    return src.replace(
      new RegExp(`from ['"]${mod}['"]`),
      `from '${mod}.js'`
    );
  },

  /** TS7006: Parameter 'x' implicitly has an 'any' type */
  TS7006: (err, src) => {
    const match = /Parameter '(.+)' implicitly/.exec(err.message);
    if (!match?.[1]) return null;
    const param = match[1];
    return src.replace(
      new RegExp(`(\\b${param}\\b)(?!\\s*:)`),
      `${param}: unknown`
    );
  },
};

// ── Implementation ────────────────────────────────────────────────────────────

export class ErrorAnalyzer implements IErrorAnalyzer {
  parse(stdout: string, stderr: string): readonly BuildError[] {
    const combined = `${stdout}\n${stderr}`;
    const errors: BuildError[] = [];

    for (const pattern of [TSC_PATTERN, ESBUILD_PATTERN]) {
      pattern.lastIndex = 0;
      for (const m of combined.matchAll(pattern)) {
        const isTsc = m.length === 7;
        errors.push(
          isTsc
            ? {
                file: m[1]!.trim(),
                line: Number(m[2]),
                column: Number(m[3]),
                severity: m[4] as 'error' | 'warning',
                code: m[5]?.trim(),
                message: m[6]!.trim(),
              }
            : {
                file: m[1]!.trim(),
                line: Number(m[2]),
                column: Number(m[3]),
                severity: m[4] as 'error' | 'warning',
                message: m[5]!.trim(),
              }
        );
      }
    }

    // Deduplicate by file+line+message
    return errors.filter(
      (e, i, arr) =>
        arr.findIndex(
          (x) => x.file === e.file && x.line === e.line && x.message === e.message
        ) === i
    );
  }

  async suggest(
    errors: readonly BuildError[],
    shadowDir: string
  ): Promise<SuggestedFix | null> {
    if (errors.length === 0) return null;

    const patches: FilePatch[] = [];

    for (const err of errors.filter((e) => e.severity === 'error')) {
      if (!err.code) continue;

      const fixer = KNOWN_FIXES[err.code];
      if (!fixer) continue;

      const absPath = join(shadowDir, err.file);
      if (!existsSync(absPath)) continue;

      const original = readFileSync(absPath, 'utf-8');
      const fixed = fixer(err, original);
      if (!fixed || fixed === original) continue;

      patches.push({
        uri: err.file,
        patch: this.#makePatch(err.file, original, fixed),
        explanation: `Auto-fix for ${err.code}: ${err.message}`,
      });
    }

    if (patches.length === 0) {
      // Unknown errors — return low-confidence stub for LLM escalation
      return {
        explanation: `${errors.length} build error(s) require manual review. Consider:\n` +
          errors.slice(0, 3).map((e) => `• ${e.file}:${e.line} — ${e.message}`).join('\n'),
        confidence: 'low',
        patches: [],
      };
    }

    return {
      explanation: `Found ${patches.length} auto-fixable error(s).`,
      confidence: patches.length === errors.filter((e) => e.severity === 'error').length
        ? 'high'
        : 'medium',
      patches,
    };
  }

  /** Minimal unified diff (line-level, for display) */
  #makePatch(file: string, before: string, after: string): string {
    const bLines = before.split('\n');
    const aLines = after.split('\n');
    const hunks: string[] = [`--- a/${file}`, `+++ b/${file}`];
    for (let i = 0; i < Math.max(bLines.length, aLines.length); i++) {
      if (bLines[i] !== aLines[i]) {
        if (bLines[i] !== undefined) hunks.push(`-${bLines[i]}`);
        if (aLines[i] !== undefined) hunks.push(`+${aLines[i]}`);
      }
    }
    return hunks.join('\n');
  }
}
