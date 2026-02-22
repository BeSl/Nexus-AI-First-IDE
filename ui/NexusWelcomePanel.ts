/**
 * NexusWelcomePanel — First-run setup wizard (4 steps).
 *
 * Guides the user through provider selection, API key entry,
 * and first intent. Saves settings directly to VS Code configuration.
 *
 * @security Settings are written via VS Code Configuration API (encrypted
 *           at rest on macOS/Win). API key is never logged or re-sent.
 */

import * as vscode from 'vscode';
import { buildWelcomeHtml } from './NexusWelcomeHtml.js';

export type LaunchCallback = (intent: string) => void;

type WizardMessage =
  | { type: 'wizard:setProvider'; provider: string }
  | { type: 'wizard:setApiKey';   provider: string; key: string }
  | { type: 'wizard:setOllamaUrl'; url: string }
  | { type: 'wizard:openUrl';     url: string }
  | { type: 'wizard:launch';      intent: string }
  | { type: 'wizard:skip' };

export class NexusWelcomePanel {
  static currentPanel: NexusWelcomePanel | undefined;

  readonly #panel: vscode.WebviewPanel;
  readonly #disposables: vscode.Disposable[] = [];
  #onLaunch: LaunchCallback;

  private constructor(panel: vscode.WebviewPanel, onLaunch: LaunchCallback) {
    this.#panel    = panel;
    this.#onLaunch = onLaunch;

    this.#panel.webview.html = buildWelcomeHtml();
    this.#panel.webview.onDidReceiveMessage(
      (msg: WizardMessage) => void this.#handle(msg),
      null, this.#disposables,
    );
    this.#panel.onDidDispose(() => this.#dispose(), null, this.#disposables);
  }

  /** Show wizard, or reveal if already open (updates launch callback). */
  static createOrShow(extensionUri: vscode.Uri, onLaunch: LaunchCallback): void {
    const col = vscode.window.activeTextEditor?.viewColumn ?? vscode.ViewColumn.One;
    if (NexusWelcomePanel.currentPanel) {
      NexusWelcomePanel.currentPanel.#onLaunch = onLaunch;
      NexusWelcomePanel.currentPanel.#panel.reveal(col);
      return;
    }
    const panel = vscode.window.createWebviewPanel(
      'nexusWelcome', 'Nexus: Мастер настройки',
      col,
      { enableScripts: true, retainContextWhenHidden: true },
    );
    NexusWelcomePanel.currentPanel = new NexusWelcomePanel(panel, onLaunch);
  }

  // ── Message handler ─────────────────────────────────────────────────────────

  async #handle(msg: WizardMessage): Promise<void> {
    const cfg = vscode.workspace.getConfiguration('nexus');

    switch (msg.type) {
      case 'wizard:setProvider':
        await cfg.update('llm.provider', msg.provider, vscode.ConfigurationTarget.Global);
        break;

      case 'wizard:setApiKey': {
        const key = msg.provider === 'anthropic'
          ? 'llm.anthropic.apiKey'
          : 'llm.gemini.apiKey';
        await cfg.update(key, msg.key, vscode.ConfigurationTarget.Global);
        break;
      }

      case 'wizard:setOllamaUrl':
        await cfg.update('llm.ollama.baseUrl', msg.url, vscode.ConfigurationTarget.Global);
        break;

      case 'wizard:openUrl':
        void vscode.env.openExternal(vscode.Uri.parse(msg.url));
        break;

      case 'wizard:launch':
        this.#panel.dispose();
        this.#onLaunch(msg.intent);
        break;

      case 'wizard:skip':
        this.#panel.dispose();
        break;
    }
  }

  #dispose(): void {
    NexusWelcomePanel.currentPanel = undefined;
    this.#panel.dispose();
    this.#disposables.forEach((d) => d.dispose());
  }
}
