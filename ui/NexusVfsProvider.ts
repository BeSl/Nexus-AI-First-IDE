/**
 * NexusVfsProvider — VS Code TreeDataProvider for staged VFS files
 *
 * Shows agent-generated artifacts as a tree in the VS Code Explorer sidebar.
 * Each file item has context menu actions: Approve, Discard, Open Diff.
 *
 * Usage:
 *   const provider = new NexusVfsProvider();
 *   vscode.window.registerTreeDataProvider('nexusVfs', provider);
 *   provider.refresh(artifacts);   // call after each agent cycle
 *
 * @security Read-only display. Write commands go through WorkspaceCommitter.
 */

import * as vscode from 'vscode';
import type { Artifact } from '../core/orchestrator.types.js';

// ── Tree Item ─────────────────────────────────────────────────────────────────

export class VfsFileItem extends vscode.TreeItem {
  constructor(
    public readonly artifact: Artifact,
    public readonly taskId: string,
  ) {
    super(artifact.path, vscode.TreeItemCollapsibleState.None);

    this.description    = artifact.type;
    this.tooltip        = `${artifact.type}: ${artifact.path}`;
    this.iconPath       = iconForType(artifact.type);
    this.contextValue   = 'nexusVfsFile';

    // Command: open read-only preview of staged content
    this.command = {
      command:   'nexus.vfs.preview',
      title:     'Preview',
      arguments: [this],
    };
  }
}

// ── Provider ─────────────────────────────────────────────────────────────────

export class NexusVfsProvider implements vscode.TreeDataProvider<VfsFileItem> {
  #artifacts: readonly Artifact[] = [];
  #taskId = '';

  readonly #changeEmitter = new vscode.EventEmitter<VfsFileItem | undefined | null | void>();
  readonly onDidChangeTreeData = this.#changeEmitter.event;

  /** Update the staged artifact list and refresh the tree */
  refresh(taskId: string, artifacts: readonly Artifact[]): void {
    this.#taskId    = taskId;
    this.#artifacts = artifacts;
    this.#changeEmitter.fire();
  }

  /** Clear all staged items (called after commit or reject) */
  clear(): void {
    this.#artifacts = [];
    this.#taskId    = '';
    this.#changeEmitter.fire();
  }

  getTreeItem(item: VfsFileItem): vscode.TreeItem { return item; }

  getChildren(): VfsFileItem[] {
    return this.#artifacts.map((a) => new VfsFileItem(a, this.#taskId));
  }

  /** Total count of staged artifacts */
  get count(): number { return this.#artifacts.length; }

  /** Current artifacts (readonly snapshot) */
  get artifacts(): readonly Artifact[] { return this.#artifacts; }

  /** Current taskId */
  get taskId(): string { return this.#taskId; }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function iconForType(type: Artifact['type']): vscode.ThemeIcon {
  switch (type) {
    case 'file':   return new vscode.ThemeIcon('file');
    case 'code':   return new vscode.ThemeIcon('symbol-method');
    case 'test':   return new vscode.ThemeIcon('beaker');
    case 'schema': return new vscode.ThemeIcon('symbol-interface');
    default:       return new vscode.ThemeIcon('file-text');
  }
}
