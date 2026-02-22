/**
 * Nexus Agent IDE — VS Code Extension Entry Point
 *
 * Registers commands and sidebar views. On first activation (or when the
 * LLM is not configured) the setup wizard opens automatically.
 *
 * IMPORTANT: Commands are registered FIRST so they are always available
 * even if view setup code throws an error later in activate().
 *
 * @security Activated on-demand. No ambient background processes.
 */

import * as vscode from 'vscode';
import { NexusGraphPanel }   from '../ui/NexusGraphPanel.js';
import { NexusVfsProvider, VfsFileItem } from '../ui/NexusVfsProvider.js';
import { NexusStatusProvider } from '../ui/NexusStatusProvider.js';
import { NexusWelcomePanel } from '../ui/NexusWelcomePanel.js';
import { WorkspaceCommitter, nodeWorkspaceFs } from './core/vfs/WorkspaceCommitter.js';
import { NexusLoop }         from './NexusLoop.js';
import { readConfigStatus }  from './NexusConfig.js';

let activeLoop:     NexusLoop          | undefined;
let vfsProvider:    NexusVfsProvider   | undefined;
let statusProvider: NexusStatusProvider | undefined;

/** @security Called by VS Code on first command or view activation. */
export function activate(ctx: vscode.ExtensionContext): void {

  // ── Helper: start agent loop with a given intent ─────────────────────────
  // Defined first so command closures can reference it.
  function startLoop(intent: string): void {
    activeLoop?.stop();
    const panel = NexusGraphPanel.createOrShow(ctx.extensionUri);
    activeLoop  = new NexusLoop(panel, ctx.extensionUri, vfsProvider);
    activeLoop.start(intent);
    statusProvider?.refresh();
  }

  // ── Helper: show setup wizard ─────────────────────────────────────────────
  function showWizard(): void {
    NexusWelcomePanel.createOrShow(ctx.extensionUri, startLoop);
  }

  // ── Register ALL commands FIRST ───────────────────────────────────────────
  // This must happen before any other setup so commands are always available,
  // even if view or provider setup later in this function throws an error.
  ctx.subscriptions.push(

    vscode.commands.registerCommand('nexus.showWelcome', showWizard),

    vscode.commands.registerCommand('nexus.openSettings', () => {
      void vscode.commands.executeCommand('workbench.action.openSettings', 'nexus.llm');
    }),

    vscode.commands.registerCommand('nexus.showGraph', () => {
      NexusGraphPanel.createOrShow(ctx.extensionUri);
    }),

    vscode.commands.registerCommand('nexus.run', async () => {
      const cfg = readConfigStatus();
      if (!cfg.isReady) {
        showWizard();   // wizard captures both config and first intent
        return;
      }
      const intent = await vscode.window.showInputBox({
        title:       'Nexus: Запустить агентный цикл',
        prompt:      'Опишите задачу',
        placeHolder: 'Например: REST API с CRUD-операциями для пользователей',
        ignoreFocusOut: true,
      });
      if (!intent?.trim()) return;
      startLoop(intent.trim());
    }),

    vscode.commands.registerCommand('nexus.vfs.approveAll', async () => {
      if (!vfsProvider || vfsProvider.count === 0) return;
      const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? process.cwd();
      const result = await new WorkspaceCommitter(nodeWorkspaceFs)
        .commit(vfsProvider.taskId, vfsProvider.artifacts, root);
      vfsProvider.clear();
      void vscode.window.showInformationMessage(`Nexus: записано ${result.written.length} файл(а).`);
    }),

    vscode.commands.registerCommand('nexus.vfs.discardAll', () => {
      vfsProvider?.clear();
      void vscode.window.showInformationMessage('Nexus: изменения отброшены.');
    }),

    // Preview staged file content in a read-only editor ─────────────────────
    vscode.commands.registerCommand('nexus.vfs.preview', async (item: unknown) => {
      if (!(item instanceof VfsFileItem)) return;
      const doc = await vscode.workspace.openTextDocument({
        content:  item.artifact.content,
        language: langFromPath(item.artifact.path),
      });
      await vscode.window.showTextDocument(doc, { preview: true, preserveFocus: false });
    }),
  );

  // ── Sidebar: Configuration status view ───────────────────────────────────
  statusProvider = new NexusStatusProvider();
  ctx.subscriptions.push(
    vscode.window.registerTreeDataProvider('nexusStatus', statusProvider),
  );

  // ── Sidebar: Staged files (VFS) view ─────────────────────────────────────
  vfsProvider = new NexusVfsProvider();
  const vfsView = vscode.window.createTreeView('nexusVfs', {
    treeDataProvider: vfsProvider,
    showCollapseAll: false,
  });
  vfsView.message = 'Нет файлов — запустите Nexus, чтобы их создать';
  vfsProvider.onDidChangeTreeData(() => {
    if (vfsProvider!.count === 0) {
      vfsView.message = 'Нет файлов — запустите Nexus, чтобы их создать';
    } else {
      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
      delete (vfsView as { message?: string }).message;
    }
  });
  ctx.subscriptions.push(vfsView);

  // ── Auto-refresh status when settings change ──────────────────────────────
  ctx.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('nexus.llm')) statusProvider?.refresh();
    }),
  );

  // ── Auto-show wizard on first run or if not configured ───────────────────
  const neverConfigured = !ctx.globalState.get<boolean>('nexus.welcomeShown');
  if (!readConfigStatus().isReady && neverConfigured) {
    void ctx.globalState.update('nexus.welcomeShown', true);
    showWizard();
  }
}

/** Detect VS Code language ID from file path extension. */
function langFromPath(p: string): string {
  if (/\.(ts|tsx)$/.test(p)) return 'typescript';
  if (/\.(js|jsx|mjs)$/.test(p)) return 'javascript';
  if (/\.json$/.test(p)) return 'json';
  if (/\.md$/.test(p)) return 'markdown';
  if (/\.(css|scss|less)$/.test(p)) return 'css';
  if (/\.html?$/.test(p)) return 'html';
  if (/\.(ya?ml)$/.test(p)) return 'yaml';
  return 'plaintext';
}

export function deactivate(): void {
  activeLoop?.stop();
  activeLoop = undefined;
}
