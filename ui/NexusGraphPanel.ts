/**
 * NexusGraphPanel — VS Code WebviewPanel hosting the React Flow architecture graph.
 *
 * Lifecycle: createOrShow() is idempotent — reveals if already open.
 * Forwards XState state changes via OrchestratorBridge.
 *
 * @security CSP nonce prevents inline script injection.
 *           localResourceRoots restricts webview to dist/webview only.
 */

import * as vscode from 'vscode';
import { OrchestratorBridge } from '../src/ui/OrchestratorBridge.js';
import type { WebviewToExtensionMessage } from '../src/ui/webview.types.js';

type MessageHandler = (msg: WebviewToExtensionMessage) => void;

export class NexusGraphPanel {
  static currentPanel: NexusGraphPanel | undefined;

  readonly #panel: vscode.WebviewPanel;
  readonly #bridge: OrchestratorBridge;
  readonly #disposables: vscode.Disposable[] = [];
  #onMessage: MessageHandler | null = null;

  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
    this.#panel = panel;
    this.#bridge = new OrchestratorBridge({
      postMessage: (msg) => this.#panel.webview.postMessage(msg),
    });
    this.#bridge.start();
    this.#panel.webview.html = this.#buildHtml(extensionUri);

    this.#panel.webview.onDidReceiveMessage(
      (msg: WebviewToExtensionMessage) => this.#onMessage?.(msg),
      null, this.#disposables,
    );
    this.#panel.onDidDispose(() => this.#dispose(), null, this.#disposables);
  }

  static createOrShow(extensionUri: vscode.Uri): NexusGraphPanel {
    const column = vscode.window.activeTextEditor?.viewColumn ?? vscode.ViewColumn.One;
    if (NexusGraphPanel.currentPanel) {
      NexusGraphPanel.currentPanel.#panel.reveal(column);
      return NexusGraphPanel.currentPanel;
    }
    const panel = vscode.window.createWebviewPanel(
      'nexusGraph', 'Nexus Architecture Graph', column,
      {
        enableScripts: true,
        localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'dist', 'webview')],
        retainContextWhenHidden: true,
      },
    );
    NexusGraphPanel.currentPanel = new NexusGraphPanel(panel, extensionUri);
    return NexusGraphPanel.currentPanel;
  }

  get bridge(): OrchestratorBridge { return this.#bridge; }

  onMessage(handler: MessageHandler): void { this.#onMessage = handler; }

  #buildHtml(extensionUri: vscode.Uri): string {
    const wv = this.#panel.webview;
    const webviewDir = vscode.Uri.joinPath(extensionUri, 'dist', 'webview');
    const scriptUri = wv.asWebviewUri(vscode.Uri.joinPath(webviewDir, 'index.js'));
    const styleUri  = wv.asWebviewUri(vscode.Uri.joinPath(webviewDir, 'index.css'));
    const nonce = genNonce();
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy"
    content="default-src 'none'; script-src 'nonce-${nonce}'; style-src ${styleUri} 'unsafe-inline';">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Nexus Architecture Graph</title>
  <link rel="stylesheet" href="${styleUri}">
  <style>html,body,#root{height:100%;margin:0;padding:0}</style>
</head>
<body>
  <div id="root"></div>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }

  #dispose(): void {
    this.#bridge.stop();
    NexusGraphPanel.currentPanel = undefined;
    this.#panel.dispose();
    this.#disposables.forEach((d) => d.dispose());
  }
}

function genNonce(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let n = '';
  for (let i = 0; i < 32; i++) n += chars[Math.floor(Math.random() * chars.length)];
  return n;
}
