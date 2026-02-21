/**
 * ShadowFS — Shadow Build Filesystem
 *
 * Copies the real project into .nexus/shadow-build/<taskId>/,
 * then overlays staged VFS changes on top. Real project is never modified.
 *
 * @security Write access is strictly limited to the shadow dir.
 */

import { cpSync, mkdirSync, writeFileSync, rmSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import type { IShadowFS } from './BuildOrchestrator.types.js';
import type { IVirtualFileSystem } from '../../../core/vfs.types.js';

/** Glob patterns excluded from shadow copy */
const EXCLUDE_DIRS = new Set(['node_modules', '.git', 'vscode-src', '.nexus', 'dist', 'out']);

export class ShadowFS implements IShadowFS {
  readonly #vfs: IVirtualFileSystem;
  readonly #shadowRoot: string;

  constructor(vfs: IVirtualFileSystem, shadowRoot: string) {
    this.#vfs = vfs;
    this.#shadowRoot = shadowRoot;
  }

  async prepare(projectRoot: string, taskId: string): Promise<string> {
    const shadowDir = join(this.#shadowRoot, taskId);

    mkdirSync(shadowDir, { recursive: true });

    cpSync(projectRoot, shadowDir, {
      recursive: true,
      filter: (src) => {
        const segment = src.replace(projectRoot, '').split('/').filter(Boolean)[0];
        return !segment || !EXCLUDE_DIRS.has(segment);
      },
    });

    await this.#overlayVfsChanges(taskId, projectRoot, shadowDir);

    return shadowDir;
  }

  async cleanup(shadowDir: string): Promise<void> {
    if (existsSync(shadowDir)) {
      rmSync(shadowDir, { recursive: true, force: true });
    }
  }

  async #overlayVfsChanges(
    taskId: string,
    projectRoot: string,
    shadowDir: string
  ): Promise<void> {
    let changeSet;
    try {
      changeSet = await this.#vfs.getChangeSet(taskId);
    } catch {
      // No staged changes for this task — shadow is a clean copy
      return;
    }

    for (const change of changeSet.changes) {
      const relative = change.uri.startsWith(projectRoot)
        ? change.uri.slice(projectRoot.length)
        : change.uri;
      const targetPath = join(shadowDir, relative);

      if (change.op === 'delete') {
        rmSync(targetPath, { force: true });
        continue;
      }

      if ((change.op === 'create' || change.op === 'update') && change.after !== null) {
        mkdirSync(dirname(targetPath), { recursive: true });
        writeFileSync(targetPath, change.after, 'utf-8');
      }
    }
  }
}
