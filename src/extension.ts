/**
 * Nexus Agent IDE — VS Code Extension Entry Point
 *
 * Registers commands, sidebar views, and the Nexus Loop orchestration.
 * On activation: validates LLM configuration and shows a warning when
 * required settings (API key) are missing.
 *
 * @security Extension is activated on-demand. No ambient background processes.
 */

import * as vscode from 'vscode';
import { NexusGraphPanel } from '../ui/NexusGraphPanel.js';
import { NexusVfsProvider } from '../ui/NexusVfsProvider.js';
import { NexusStatusProvider } from '../ui/NexusStatusProvider.js';
import { WorkspaceCommitter, nodeWorkspaceFs } from './core/vfs/WorkspaceCommitter.js';
import { NexusLoop } from './NexusLoop.js';
import { readConfigStatus } from './NexusConfig.js';

let activeLoop: NexusLoop | undefined;
let vfsProvider: NexusVfsProvider | undefined;
let statusProvider: NexusStatusProvider | undefined;

/** @security Called by VS Code on first command activation. */
export function activate(ctx: vscode.ExtensionContext): void {

  // ── Sidebar: Configuration status view ───────────────────────────────────
  statusProvider = new NexusStatusProvider();
  ctx.subscriptions.push(
    vscode.window.registerTreeDataProvider('nexusStatus', statusProvider),
  );

  // ── Sidebar: Staged files (VFS) view ─────────────────────────────────────
  // Use createTreeView so we can set .message for the empty state
  vfsProvider = new NexusVfsProvider();
  const vfsView = vscode.window.createTreeView('nexusVfs', {
    treeDataProvider: vfsProvider,
    showCollapseAll: false,
  });
  vfsView.message = 'No staged files — run the Agent Loop to generate files';
  vfsProvider.onDidChangeTreeData(() => {
    if (vfsProvider!.count === 0) {
      vfsView.message = 'No staged files — run the Agent Loop to generate files';
    } else {
      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
      delete (vfsView as { message?: string }).message;
    }
  });
  ctx.subscriptions.push(vfsView);

  // ── Auto-refresh status when user changes nexus settings ─────────────────
  ctx.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('nexus.llm')) statusProvider?.refresh();
    }),
  );

  ctx.subscriptions.push(

    // Open Nexus settings page ──────────────────────────────────────────────
    vscode.commands.registerCommand('nexus.openSettings', () => {
      void vscode.commands.executeCommand('workbench.action.openSettings', 'nexus.llm');
    }),

    // Show architecture graph panel ─────────────────────────────────────────
    vscode.commands.registerCommand('nexus.showGraph', () => {
      NexusGraphPanel.createOrShow(ctx.extensionUri);
    }),

    // Run the full Nexus Agent Loop ─────────────────────────────────────────
    vscode.commands.registerCommand('nexus.run', async () => {
      // Warn if API key is missing but still allow user to proceed (env var may be set)
      const cfg = readConfigStatus();
      if (!cfg.isReady) {
        const choice = await vscode.window.showWarningMessage(
          `Nexus: ${cfg.missingHint}`,
          'Open Settings',
          'Run Anyway',
        );
        if (choice === 'Open Settings') {
          void vscode.commands.executeCommand('workbench.action.openSettings', 'nexus.llm');
          return;
        }
        if (choice !== 'Run Anyway') return;
      }

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
      statusProvider?.refresh();
    }),

    // Approve all staged files and write to workspace ───────────────────────
    vscode.commands.registerCommand('nexus.vfs.approveAll', async () => {
      if (!vfsProvider || vfsProvider.count === 0) return;
      const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? process.cwd();
      const committer = new WorkspaceCommitter(nodeWorkspaceFs);
      const result = await committer.commit(vfsProvider.taskId, vfsProvider.artifacts, workspaceRoot);
      vfsProvider.clear();
      void vscode.window.showInformationMessage(`Nexus: wrote ${result.written.length} file(s).`);
    }),

    // Discard all staged files ──────────────────────────────────────────────
    vscode.commands.registerCommand('nexus.vfs.discardAll', () => {
      vfsProvider?.clear();
      void vscode.window.showInformationMessage('Nexus: staged files discarded.');
    }),
  );

  // ── Activation warning when API key is not configured ────────────────────
  const cfg = readConfigStatus();
  if (!cfg.isReady) {
    void vscode.window.showWarningMessage(
      `Nexus: ${cfg.missingHint}`,
      'Open Settings',
    ).then((choice) => {
      if (choice === 'Open Settings')
        void vscode.commands.executeCommand('workbench.action.openSettings', 'nexus.llm');
    });
  }
}

export function deactivate(): void {
  activeLoop?.stop();
  activeLoop = undefined;
}
