/**
 * NodeFileReader — IFileReader backed by Node.js fs.promises
 *
 * Production implementation of IFileReader.
 * Tests inject a stub instead — never use this in unit tests.
 *
 * @security Only reads files — no writes. Path traversal is caller's responsibility.
 */

import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import type { IFileReader } from './ContextEngine.js';

export class NodeFileReader implements IFileReader {
  async read(uri: string): Promise<string> {
    return readFile(uri, 'utf-8');
  }
}

/**
 * Collect all .ts files recursively from a directory.
 * Used to pre-index a project into ContextEngine.
 * @security Read-only FS traversal.
 */
export async function collectTsFiles(
  dir: string,
  exclude: readonly string[] = ['node_modules', '.git', 'vscode-src', 'dist'],
): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const results: string[] = [];

  for (const entry of entries) {
    if (exclude.some((ex) => entry.name === ex)) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...await collectTsFiles(full, exclude));
    } else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.spec.ts')) {
      results.push(full);
    }
  }
  return results;
}
