/**
 * Virtual File System (VFS) — Type Contracts
 *
 * Sandbox layer where agents stage changes before user approval.
 * No agent write reaches the real disk without explicit user confirmation.
 *
 * @security All writes are staged. Real FS only touched after user confirm().
 */

/** A staged file operation not yet applied to disk */
export interface PendingChange {
  readonly id: string;
  readonly taskId: string;
  readonly agentId: string;
  readonly op: 'create' | 'update' | 'delete' | 'rename';
  readonly uri: string;
  readonly targetUri?: string;       // for rename ops
  readonly before: string | null;    // null for 'create'
  readonly after: string | null;     // null for 'delete'
  readonly createdAt: Date;
}

/** A named collection of pending changes (like a git branch) */
export interface ChangeSet {
  readonly id: string;
  readonly taskId: string;
  readonly label: string;
  readonly changes: readonly PendingChange[];
  readonly status: 'staged' | 'confirmed' | 'rejected';
}

/** Diff summary shown to the user before confirmation */
export interface DiffSummary {
  readonly changeSetId: string;
  readonly filesChanged: number;
  readonly linesAdded: number;
  readonly linesRemoved: number;
  readonly hunks: readonly DiffHunk[];
}

export interface DiffHunk {
  readonly uri: string;
  readonly op: PendingChange['op'];
  readonly patch: string;  // unified diff format
}

export interface IVirtualFileSystem {
  /** Read a file — returns staged content if pending, else real disk content */
  read(uri: string, taskId?: string): Promise<string>;

  /** Stage a write to the sandbox — does NOT touch disk */
  write(uri: string, content: string, taskId: string, agentId: string): Promise<PendingChange>;

  /** Stage a delete */
  delete(uri: string, taskId: string, agentId: string): Promise<PendingChange>;

  /** Get all staged changes for a task */
  getChangeSet(taskId: string): Promise<ChangeSet>;

  /** Compute diff for user review */
  diff(taskId: string): Promise<DiffSummary>;

  /**
   * Apply staged changes to real disk.
   * @security Only called after explicit user approval.
   */
  confirm(changeSetId: string): Promise<void>;

  /** Discard all staged changes for a task */
  reject(changeSetId: string): Promise<void>;
}
