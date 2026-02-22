/**
 * WorkspaceCommitter — Artifact Writer
 *
 * Writes XState context Artifact[] (type='file') to the workspace filesystem.
 * Uses an injectable IWorkspaceFs so production code can pass the VS Code
 * workspace.fs adapter while tests supply a simple in-memory mock.
 *
 * Flow:
 *   1. Filter artifacts → file type only
 *   2. Ensure parent directories exist
 *   3. Write content via IWorkspaceFs
 *   4. Return list of written paths
 *
 * @security Never called without user confirmation (NexusLoop gate).
 *           Writes only paths inside workspaceRoot.
 */

import { join, dirname, isAbsolute, relative } from 'path';
import type { Artifact } from '../../../core/orchestrator.types.js';

// ── Injectable FS interface ───────────────────────────────────────────────────

export interface IWorkspaceFs {
  /** Write UTF-8 content to an absolute path. Creates file if it doesn't exist. */
  writeFile(absolutePath: string, content: string): Promise<void>;
  /** Ensure a directory (and all parents) exists. No-op if already exists. */
  createDirectory(absolutePath: string): Promise<void>;
}

// ── Result type ───────────────────────────────────────────────────────────────

export interface WorkspaceCommitResult {
  readonly taskId: string;
  readonly written: readonly string[];
  readonly skipped: readonly string[];
}

// ── Implementation ────────────────────────────────────────────────────────────

export class WorkspaceCommitter {
  readonly #fs: IWorkspaceFs;

  constructor(fs: IWorkspaceFs) {
    this.#fs = fs;
  }

  /**
   * Write all file-type artifacts to disk under workspaceRoot.
   * Paths that escape workspaceRoot (path traversal) are silently skipped.
   *
   * @security Validates each path stays within workspaceRoot.
   */
  async commit(
    taskId: string,
    artifacts: readonly Artifact[],
    workspaceRoot: string,
  ): Promise<WorkspaceCommitResult> {
    const written: string[] = [];
    const skipped: string[] = [];

    const fileArtifacts = artifacts.filter((a) => a.type === 'file' || a.type === 'code');

    for (const artifact of fileArtifacts) {
      const absPath = this.#resolve(artifact.path, workspaceRoot);
      if (!absPath) {
        skipped.push(artifact.path);
        continue;
      }
      await this.#fs.createDirectory(dirname(absPath));
      await this.#fs.writeFile(absPath, artifact.content);
      written.push(absPath);
    }

    return { taskId, written, skipped };
  }

  // ── Private ────────────────────────────────────────────────────────────────

  /** Resolve artifact path inside workspace, return null if path traversal detected */
  #resolve(artifactPath: string, workspaceRoot: string): string | null {
    const abs = isAbsolute(artifactPath)
      ? artifactPath
      : join(workspaceRoot, artifactPath);

    // Security: reject paths escaping workspaceRoot
    const rel = relative(workspaceRoot, abs);
    if (rel.startsWith('..')) return null;

    return abs;
  }
}

// ── Node.js production adapter ────────────────────────────────────────────────

import { promises as fsp } from 'fs';

/** Default adapter using Node.js fs.promises */
export const nodeWorkspaceFs: IWorkspaceFs = {
  async writeFile(absolutePath: string, content: string): Promise<void> {
    await fsp.writeFile(absolutePath, content, 'utf-8');
  },
  async createDirectory(absolutePath: string): Promise<void> {
    await fsp.mkdir(absolutePath, { recursive: true });
  },
};
