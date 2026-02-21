/**
 * InMemoryVFS — IVirtualFileSystem Implementation
 *
 * All agent writes are staged as PendingChange objects.
 * Real disk is only touched after explicit VFS.confirm().
 *
 * Thread model: single-writer per taskId (agents run sequentially per task).
 *
 * @security confirm() is the only path to real FS writes.
 *           All other methods are pure in-memory operations.
 */

import { readFileSync, writeFileSync, unlinkSync, mkdirSync, existsSync } from 'fs';
import { dirname } from 'path';
import { randomUUID } from 'crypto';
import type {
  IVirtualFileSystem,
  PendingChange,
  ChangeSet,
  DiffSummary,
  DiffHunk,
} from '../../../core/vfs.types.js';

export class InMemoryVFS implements IVirtualFileSystem {
  /** taskId → ordered list of staged changes */
  readonly #changes = new Map<string, PendingChange[]>();
  /** changeSetId → taskId (for confirm/reject lookup) */
  readonly #sets = new Map<string, string>();

  // ── IVirtualFileSystem ──────────────────────────────────────────────────────

  async read(uri: string, taskId?: string): Promise<string> {
    if (taskId) {
      // Return latest staged version if it exists
      const staged = this.#latestChange(uri, taskId);
      if (staged?.op === 'delete') throw new Error(`File deleted in VFS: ${uri}`);
      if (staged?.after !== null && staged?.after !== undefined) return staged.after;
    }
    return readFileSync(uri, 'utf-8');
  }

  async write(uri: string, content: string, taskId: string, agentId: string): Promise<PendingChange> {
    const before = this.#readCurrentContent(uri, taskId);
    const op = before === null ? 'create' : 'update';
    return this.#stage({ uri, op, before, after: content, taskId, agentId });
  }

  async delete(uri: string, taskId: string, agentId: string): Promise<PendingChange> {
    const before = this.#readCurrentContent(uri, taskId);
    return this.#stage({ uri, op: 'delete', before, after: null, taskId, agentId });
  }

  async getChangeSet(taskId: string): Promise<ChangeSet> {
    const changes = this.#changes.get(taskId) ?? [];
    const id = this.#findOrCreateSetId(taskId);
    return { id, taskId, label: `Task ${taskId}`, changes, status: 'staged' };
  }

  async diff(taskId: string): Promise<DiffSummary> {
    const { id, changes } = await this.getChangeSet(taskId);
    let linesAdded = 0;
    let linesRemoved = 0;
    const hunks: DiffHunk[] = [];

    for (const c of changes) {
      const patch = unifiedDiff(c.uri, c.before ?? '', c.after ?? '');
      const added = (patch.match(/^\+[^+]/gm) ?? []).length;
      const removed = (patch.match(/^-[^-]/gm) ?? []).length;
      linesAdded += added;
      linesRemoved += removed;
      hunks.push({ uri: c.uri, op: c.op, patch });
    }

    return { changeSetId: id, filesChanged: changes.length, linesAdded, linesRemoved, hunks };
  }

  async confirm(changeSetId: string): Promise<void> {
    const taskId = this.#sets.get(changeSetId);
    if (!taskId) throw new Error(`Unknown changeSetId: ${changeSetId}`);

    const changes = this.#changes.get(taskId) ?? [];
    for (const c of changes) {
      if (c.op === 'delete') {
        if (existsSync(c.uri)) unlinkSync(c.uri);
      } else if (c.after !== null) {
        mkdirSync(dirname(c.uri), { recursive: true });
        writeFileSync(c.uri, c.after, 'utf-8');
      }
    }
    this.#changes.delete(taskId);
    this.#sets.delete(changeSetId);
  }

  async reject(changeSetId: string): Promise<void> {
    const taskId = this.#sets.get(changeSetId);
    if (!taskId) return;
    this.#changes.delete(taskId);
    this.#sets.delete(changeSetId);
  }

  // ── Private ──────────────────────────────────────────────────────────────────

  #stage(params: Omit<PendingChange, 'id' | 'createdAt'>): PendingChange {
    const change: PendingChange = { ...params, id: randomUUID(), createdAt: new Date() };
    const list = this.#changes.get(params.taskId) ?? [];
    this.#changes.set(params.taskId, [...list, change]);
    return change;
  }

  #latestChange(uri: string, taskId: string): PendingChange | undefined {
    const changes = this.#changes.get(taskId) ?? [];
    return [...changes].reverse().find((c) => c.uri === uri);
  }

  #readCurrentContent(uri: string, taskId: string): string | null {
    const staged = this.#latestChange(uri, taskId);
    if (staged) return staged.after;
    try { return readFileSync(uri, 'utf-8'); } catch { return null; }
  }

  #findOrCreateSetId(taskId: string): string {
    for (const [setId, tid] of this.#sets) if (tid === taskId) return setId;
    const id = randomUUID();
    this.#sets.set(id, taskId);
    return id;
  }
}

// ── Minimal unified diff ──────────────────────────────────────────────────────

function unifiedDiff(path: string, before: string, after: string): string {
  const a = before.split('\n');
  const b = after.split('\n');
  const lines = [`--- a/${path}`, `+++ b/${path}`];
  const maxLen = Math.max(a.length, b.length);
  for (let i = 0; i < maxLen; i++) {
    if (a[i] !== b[i]) {
      if (i < a.length) lines.push(`-${a[i]}`);
      if (i < b.length) lines.push(`+${b[i]}`);
    }
  }
  return lines.join('\n');
}
