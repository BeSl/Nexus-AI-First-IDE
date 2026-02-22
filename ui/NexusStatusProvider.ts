/**
 * NexusStatusProvider — Sidebar configuration status & quick-start view
 *
 * Shows the current LLM configuration health at a glance:
 *   - Provider (anthropic / gemini / ollama)
 *   - API key presence (or Ollama URL)
 *   - Active model
 *   - Quick-action buttons: Run, Open Settings, Show Graph
 *
 * Missing settings are highlighted with error/warning icons and
 * clicking on them opens the relevant settings page directly.
 *
 * @security Never logs or exposes raw key values — presence only.
 */

import * as vscode from 'vscode';
import { readConfigStatus, type NexusConfigStatus } from '../src/NexusConfig.js';

// ── Theme icons with semantic colours ─────────────────────────────────────────

const iconOk    = () => new vscode.ThemeIcon('check', new vscode.ThemeColor('testing.iconPassed'));
const iconError = () => new vscode.ThemeIcon('error', new vscode.ThemeColor('testing.iconFailed'));
const iconInfo  = () => new vscode.ThemeIcon('info', new vscode.ThemeColor('editorInfo.foreground'));

// ── Tree item ──────────────────────────────────────────────────────────────────

class StatusItem extends vscode.TreeItem {
  constructor(
    label: string,
    icon: vscode.ThemeIcon,
    description?: string,
    tooltip?: vscode.MarkdownString | string,
    commandId?: string,
  ) {
    super(label, vscode.TreeItemCollapsibleState.None);
    this.iconPath = icon;
    if (description !== undefined) this.description = description;
    if (tooltip !== undefined) this.tooltip = tooltip;
    if (commandId) {
      this.command = { command: commandId, title: label, arguments: [] };
    }
  }
}

// ── Provider ───────────────────────────────────────────────────────────────────

const PROVIDER_NAMES: Record<string, string> = {
  anthropic: 'Anthropic (Claude)',
  gemini:    'Google Gemini',
  ollama:    'Ollama (local)',
};

const DEFAULT_MODELS: Record<string, string> = {
  anthropic: 'claude-sonnet-4-6',
  gemini:    'gemini-2.0-flash',
  ollama:    '(set in nexus.llm.model)',
};

export class NexusStatusProvider implements vscode.TreeDataProvider<StatusItem> {
  readonly #emitter = new vscode.EventEmitter<void>();
  readonly onDidChangeTreeData = this.#emitter.event;

  refresh(): void { this.#emitter.fire(); }

  getTreeItem(item: StatusItem): vscode.TreeItem { return item; }

  getChildren(): StatusItem[] {
    const s = readConfigStatus();
    return [...this.#configItems(s), ...this.#actionItems(s)];
  }

  // ── Configuration rows ──────────────────────────────────────────────────────

  #configItems(s: NexusConfigStatus): StatusItem[] {
    const items: StatusItem[] = [
      new StatusItem(
        'Provider',
        iconOk(),
        PROVIDER_NAMES[s.provider] ?? s.provider,
        'Change with **nexus.llm.provider** setting',
        'nexus.openSettings',
      ),
    ];

    if (s.provider === 'ollama') {
      items.push(new StatusItem(
        'Ollama URL',
        iconInfo(),
        s.ollamaUrl,
        `Server: \`${s.ollamaUrl}\`\nChange with **nexus.llm.ollama.baseUrl**`,
        'nexus.openSettings',
      ));
    } else {
      const keyName = s.provider === 'anthropic' ? 'Anthropic API Key' : 'Gemini API Key';
      items.push(new StatusItem(
        keyName,
        s.apiKeyConfigured ? iconOk() : iconError(),
        s.apiKeyConfigured ? '●●●● configured' : '⚠ not set — click to fix',
        s.apiKeyConfigured
          ? 'API key is configured. Keep it secret.'
          : new vscode.MarkdownString(s.missingHint),
        s.apiKeyConfigured ? undefined : 'nexus.openSettings',
      ));
    }

    const modelDisplay = s.model ?? `${DEFAULT_MODELS[s.provider] ?? 'default'} (default)`;
    items.push(new StatusItem(
      'Model',
      new vscode.ThemeIcon('symbol-string'),
      modelDisplay,
      s.model ? `Custom model: \`${s.model}\`` : 'Using provider default. Override with **nexus.llm.model**',
    ));

    return items;
  }

  // ── Action rows ─────────────────────────────────────────────────────────────

  #actionItems(s: NexusConfigStatus): StatusItem[] {
    return [
      new StatusItem(
        'Run Agent Loop…',
        new vscode.ThemeIcon('play'),
        s.isReady ? undefined : 'setup required',
        s.isReady
          ? 'Start the Nexus agentic pipeline'
          : `Cannot run: ${s.missingHint}`,
        'nexus.run',
      ),
      new StatusItem(
        'Open Settings',
        new vscode.ThemeIcon('gear'),
        undefined,
        'Configure LLM provider and API keys',
        'nexus.openSettings',
      ),
      new StatusItem(
        'Show Architecture Graph',
        new vscode.ThemeIcon('type-hierarchy-super'),
        undefined,
        'Open the React Flow agent pipeline visualization',
        'nexus.showGraph',
      ),
    ];
  }
}
