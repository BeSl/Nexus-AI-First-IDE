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
import { NexusLoop } from './NexusLoop.js';

let activeLoop: NexusLoop | undefined;

/** @security Called by VS Code on first command activation. */
export function activate(ctx: vscode.ExtensionContext): void {
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
      activeLoop = new NexusLoop(panel, ctx.extensionUri);
      activeLoop.start(intent.trim());
    }),
  );
}

export function deactivate(): void {
  activeLoop?.stop();
  activeLoop = undefined;
}
