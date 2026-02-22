/**
 * NexusApprovalPanel — VS Code Webview for Architect Plan Approval
 *
 * Displays Architect artifacts for user review before code generation.
 * Sends USER_APPROVED / USER_REJECTED commands to the XState orchestrator.
 *
 * @security HTML is generated in the extension process and sanitized.
 *           No user content is eval'd in the webview.
 */

import * as vscode from 'vscode';
import type { Artifact } from '../core/orchestrator.types.js';

type ApprovalCallback = (approved: boolean) => void;

export class NexusApprovalPanel {
  static currentPanel: NexusApprovalPanel | undefined;

  readonly #panel: vscode.WebviewPanel;
  readonly #disposables: vscode.Disposable[] = [];
  readonly #onDecision: ApprovalCallback;

  private constructor(
    panel: vscode.WebviewPanel,
    artifacts: readonly Artifact[],
    onDecision: ApprovalCallback,
  ) {
    this.#panel = panel;
    this.#onDecision = onDecision;
    this.#panel.webview.html = this.#buildHtml(artifacts);

    this.#panel.webview.onDidReceiveMessage(
      (msg: { command: string }) => {
        if (msg.command === 'approve') this.#onDecision(true);
        if (msg.command === 'reject')  this.#onDecision(false);
        this.#panel.dispose();
      },
      null, this.#disposables,
    );

    this.#panel.onDidDispose(() => this.#dispose(), null, this.#disposables);
  }

  static createOrShow(
    extensionUri: vscode.Uri,
    artifacts: readonly Artifact[],
    onDecision: ApprovalCallback,
  ): void {
    const column = vscode.window.activeTextEditor?.viewColumn;
    if (NexusApprovalPanel.currentPanel) {
      NexusApprovalPanel.currentPanel.#panel.reveal(column);
      return;
    }
    const panel = vscode.window.createWebviewPanel(
      'nexusApproval', 'Nexus: Architect Plan',
      column ?? vscode.ViewColumn.One,
      { enableScripts: true },
    );
    NexusApprovalPanel.currentPanel = new NexusApprovalPanel(panel, artifacts, onDecision);
  }

  #dispose(): void {
    NexusApprovalPanel.currentPanel = undefined;
    this.#panel.dispose();
    this.#disposables.forEach((d) => d.dispose());
  }

  #buildHtml(artifacts: readonly Artifact[]): string {
    const cards = artifacts.map((a) => `
      <div class="card">
        <div class="hdr"><span class="badge">${esc(a.type.toUpperCase())}</span>
          <code>${esc(a.path)}</code></div>
        <pre>${esc(a.content.slice(0, 300))}${a.content.length > 300 ? '\n...' : ''}</pre>
      </div>`).join('');

    return `<!DOCTYPE html><html lang="en"><head><style>
      body{font-family:var(--vscode-font-family);color:var(--vscode-foreground);padding:20px}
      .card{border:1px solid var(--vscode-widget-border);border-radius:4px;margin-bottom:12px}
      .hdr{padding:8px 12px;display:flex;align-items:center;gap:10px;border-bottom:1px solid var(--vscode-widget-border)}
      .badge{font-size:10px;padding:2px 6px;border-radius:3px;font-weight:bold;
             background:var(--vscode-button-background);color:var(--vscode-button-foreground)}
      pre{margin:0;padding:12px;font-size:12px;background:var(--vscode-textCodeBlock-background);overflow:auto}
      .actions{position:sticky;bottom:0;padding:16px 0;display:flex;gap:10px;
               background:var(--vscode-sideBar-background);border-top:1px solid var(--vscode-widget-border)}
      button{cursor:pointer;padding:8px 16px;border:none;border-radius:2px;font-weight:bold}
      .ok{background:var(--vscode-button-background);color:var(--vscode-button-foreground)}
      .no{background:var(--vscode-button-secondaryBackground);color:var(--vscode-button-secondaryForeground)}
    </style></head><body>
      <h2>Architectural Plan</h2><p>${artifacts.length} artifact(s) from Architect Agent:</p>
      ${cards}
      <div class="actions">
        <button class="ok" onclick="vscode.postMessage({command:'approve'})">Approve &amp; Implement</button>
        <button class="no" onclick="vscode.postMessage({command:'reject'})">Reject</button>
      </div>
      <script>const vscode=acquireVsCodeApi();</script>
    </body></html>`;
  }
}

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] ?? c));
}
