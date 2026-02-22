/**
 * NexusStatusProvider — Unit Tests
 *
 * Verifies sidebar item structure, icon semantics, and command wiring
 * across all LLM provider configurations.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { NexusConfigStatus } from '../src/NexusConfig.js';

// ── vscode mock ───────────────────────────────────────────────────────────────

vi.mock('vscode', () => ({
  TreeItem: class {
    label: string; collapsibleState: number;
    description?: string; tooltip?: unknown;
    command?: unknown; iconPath?: unknown;
    constructor(label: string, state: number) { this.label = label; this.collapsibleState = state; }
  },
  TreeItemCollapsibleState: { None: 0, Collapsed: 1, Expanded: 2 },
  ThemeIcon:    class { constructor(public id: string, public color?: unknown) {} },
  ThemeColor:   class { constructor(public id: string) {} },
  MarkdownString: class { constructor(public value: string) {} },
  EventEmitter: class { event = vi.fn(); fire = vi.fn(); dispose = vi.fn(); },
}));

// ── NexusConfig mock ──────────────────────────────────────────────────────────

let _status: NexusConfigStatus = {
  provider:         'anthropic',
  model:            undefined,
  apiKeyConfigured: false,
  ollamaUrl:        'http://localhost:11434',
  isReady:          false,
  missingHint:      'Add Anthropic API key in Settings → nexus.llm.anthropic.apiKey',
};

vi.mock('../src/NexusConfig.js', () => ({
  readConfigStatus: () => _status,
}));

import { NexusStatusProvider } from './NexusStatusProvider.js';

// ── Helper types & utils ──────────────────────────────────────────────────────

type Item = {
  label:        string;
  description?: string;
  iconPath?:    { id: string };
  command?:     { command: string };
};

const BASE: NexusConfigStatus = {
  provider:         'anthropic',
  model:            undefined,
  apiKeyConfigured: false,
  ollamaUrl:        'http://localhost:11434',
  isReady:          false,
  missingHint:      'Add Anthropic API key in Settings',
};

beforeEach(() => { _status = { ...BASE }; });

function items(overrides?: Partial<NexusConfigStatus>): Item[] {
  if (overrides) _status = { ..._status, ...overrides };
  return new NexusStatusProvider().getChildren() as unknown as Item[];
}

// ── Configuration section ─────────────────────────────────────────────────────

describe('NexusStatusProvider — item count', () => {
  it('renders 6 items total (3 config + 3 actions)', () => {
    expect(items()).toHaveLength(6);
  });
});

describe('NexusStatusProvider — provider row (index 0)', () => {
  it('label is "Provider"', () => {
    expect(items()[0]!.label).toBe('Provider');
  });

  it('always shows check icon', () => {
    expect(items()[0]!.iconPath?.id).toBe('check');
  });

  it('description is human-readable Anthropic name', () => {
    expect(items()[0]!.description).toBe('Anthropic (Claude)');
  });

  it('description is human-readable Gemini name', () => {
    expect(items({ provider: 'gemini' })[0]!.description).toBe('Google Gemini');
  });

  it('description is human-readable Ollama name', () => {
    expect(items({ provider: 'ollama', apiKeyConfigured: true, isReady: true })[0]!.description)
      .toBe('Ollama (local)');
  });
});

describe('NexusStatusProvider — API key row (index 1)', () => {
  it('shows error icon when Anthropic key missing', () => {
    expect(items()[1]!.iconPath?.id).toBe('error');
  });

  it('description contains warning text when key missing', () => {
    expect(items()[1]!.description).toContain('not set');
  });

  it('has nexus.openSettings command when key missing', () => {
    expect(items()[1]!.command?.command).toBe('nexus.openSettings');
  });

  it('shows check icon when Anthropic key configured', () => {
    expect(items({ apiKeyConfigured: true, isReady: true })[1]!.iconPath?.id).toBe('check');
  });

  it('description shows "configured" when key is set', () => {
    expect(items({ apiKeyConfigured: true, isReady: true })[1]!.description).toContain('configured');
  });

  it('no command when key configured (already working)', () => {
    expect(items({ apiKeyConfigured: true, isReady: true })[1]!.command).toBeUndefined();
  });

  it('label is "Gemini API Key" for gemini provider', () => {
    expect(items({ provider: 'gemini' })[1]!.label).toBe('Gemini API Key');
  });

  it('label is "Anthropic API Key" for anthropic provider', () => {
    expect(items()[1]!.label).toBe('Anthropic API Key');
  });
});

describe('NexusStatusProvider — Ollama URL row (index 1)', () => {
  it('label is "Ollama URL" for ollama provider', () => {
    expect(items({ provider: 'ollama', apiKeyConfigured: true, isReady: true })[1]!.label)
      .toBe('Ollama URL');
  });

  it('description shows the Ollama server URL', () => {
    expect(items({ provider: 'ollama', apiKeyConfigured: true, isReady: true,
      ollamaUrl: 'http://myhost:11434' })[1]!.description)
      .toBe('http://myhost:11434');
  });
});

describe('NexusStatusProvider — model row (index 2)', () => {
  it('label is "Model"', () => {
    expect(items()[2]!.label).toBe('Model');
  });

  it('description includes "(default)" when no model override', () => {
    expect(items()[2]!.description).toContain('default');
  });

  it('description shows custom model when configured', () => {
    expect(items({ model: 'claude-opus-4-6' })[2]!.description).toBe('claude-opus-4-6');
  });
});

// ── Actions section ───────────────────────────────────────────────────────────

describe('NexusStatusProvider — run action (index 3)', () => {
  it('command is nexus.run', () => {
    expect(items()[3]!.command?.command).toBe('nexus.run');
  });

  it('description is "setup required" when not ready', () => {
    expect(items()[3]!.description).toBe('setup required');
  });

  it('no description when ready', () => {
    expect(items({ apiKeyConfigured: true, isReady: true })[3]!.description).toBeUndefined();
  });

  it('icon is "play"', () => {
    expect(items()[3]!.iconPath?.id).toBe('play');
  });
});

describe('NexusStatusProvider — settings action (index 4)', () => {
  it('command is nexus.openSettings', () => {
    expect(items()[4]!.command?.command).toBe('nexus.openSettings');
  });

  it('label is "Open Settings"', () => {
    expect(items()[4]!.label).toBe('Open Settings');
  });
});

describe('NexusStatusProvider — graph action (index 5)', () => {
  it('command is nexus.showGraph', () => {
    expect(items()[5]!.command?.command).toBe('nexus.showGraph');
  });

  it('label is "Show Architecture Graph"', () => {
    expect(items()[5]!.label).toBe('Show Architecture Graph');
  });
});

describe('NexusStatusProvider.refresh', () => {
  it('does not throw', () => {
    const provider = new NexusStatusProvider();
    expect(() => provider.refresh()).not.toThrow();
  });
});
