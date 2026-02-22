/**
 * Nexus Agent IDE — VS Code Extension Entry Point
 *
 * Registers two commands:
 *   nexus.showGraph — open the React Flow architecture graph panel.
 *   nexus.run       — prompt for intent, start the full Nexus Loop.
 *
 * @security Extension is activated on-demand. No ambient background processes.
 */

import * as vscode from 'vscode';
import { NexusGraphPanel } from '../ui/NexusGraphPanel.js';
import { NexusVfsProvider } from '../ui/NexusVfsProvider.js';
import { WorkspaceCommitter, nodeWorkspaceFs } from './core/vfs/WorkspaceCommitter.js';
import { NexusLoop } from './NexusLoop.js';

let activeLoop: NexusLoop | undefined;
let vfsProvider: NexusVfsProvider | undefined;

/** @security Called by VS Code on first command activation. */
export function activate(ctx: vscode.ExtensionContext): void {
  // ── VFS Sidebar Tree View ────────────────────────────────────────────────
  vfsProvider = new NexusVfsProvider();
  ctx.subscriptions.push(
    vscode.window.registerTreeDataProvider('nexusVfs', vfsProvider),
  );

  ctx.subscriptions.push(
    vscode.commands.registerCommand('nexus.showGraph', () => {
      NexusGraphPanel.createOrShow(ctx.extensionUri);
    }),

    vscode.commands.registerCommand('nexus.run', async () => {
      const intent = await vscode.window.showInputBox({
        title: 'Nexus: Start Agent Loop',
        prompt: 'Describe what you want to build',
        placeHolder: 'e.g. Create a REST API with CRUD operations for users',
        ignoreFocusOut: true,
      });
      if (!intent?.trim()) return;

      activeLoop?.stop();
      const panel = NexusGraphPanel.createOrShow(ctx.extensionUri);
      activeLoop = new NexusLoop(panel, ctx.extensionUri, vfsProvider);
      activeLoop.start(intent.trim());
    }),

    // Approve all staged files and write to workspace
    vscode.commands.registerCommand('nexus.vfs.approveAll', async () => {
      if (!vfsProvider || vfsProvider.count === 0) return;
      const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? process.cwd();
      const committer = new WorkspaceCommitter(nodeWorkspaceFs);
      const result = await committer.commit(vfsProvider.taskId, vfsProvider.artifacts, workspaceRoot);
      vfsProvider.clear();
      void vscode.window.showInformationMessage(`Nexus: wrote ${result.written.length} file(s).`);
    }),

    // Discard all staged files
    vscode.commands.registerCommand('nexus.vfs.discardAll', () => {
      vfsProvider?.clear();
      void vscode.window.showInformationMessage('Nexus: staged files discarded.');
    }),
  );
}

export function deactivate(): void {
  activeLoop?.stop();
  activeLoop = undefined;
}
