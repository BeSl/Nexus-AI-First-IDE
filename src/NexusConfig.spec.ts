/**
 * NexusConfig — Unit Tests
 * vscode.workspace is mocked; env vars are set/cleared per test.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── VS Code mock ──────────────────────────────────────────────────────────────

// Mutable settings bag — tests write here to simulate VS Code settings UI
const _vsCfg: Record<string, string> = {};

vi.mock('vscode', () => ({
  workspace: {
    getConfiguration: (_section: string) => ({
      get: (key: string) => _vsCfg[key] ?? undefined,
    }),
  },
}));

import { readGatewayOptions, readConfigStatus } from './NexusConfig.js';

function clearEnv() {
  delete process.env['NEXUS_LLM_PROVIDER'];
  delete process.env['ANTHROPIC_API_KEY'];
  delete process.env['GEMINI_API_KEY'];
  delete process.env['OLLAMA_BASE_URL'];
  delete process.env['OLLAMA_MODEL'];
}

beforeEach(() => {
  Object.keys(_vsCfg).forEach((k) => delete _vsCfg[k]);
  clearEnv();
});
afterEach(clearEnv);

// ── provider selection ────────────────────────────────────────────────────────

describe('readGatewayOptions — provider', () => {
  it('defaults to anthropic when nothing configured', () => {
    expect(readGatewayOptions().provider).toBe('anthropic');
  });

  it('reads provider from VS Code setting', () => {
    _vsCfg['llm.provider'] = 'gemini';
    expect(readGatewayOptions().provider).toBe('gemini');
  });

  it('reads provider from NEXUS_LLM_PROVIDER env', () => {
    process.env['NEXUS_LLM_PROVIDER'] = 'ollama';
    expect(readGatewayOptions().provider).toBe('ollama');
  });

  it('VS Code setting overrides env variable', () => {
    process.env['NEXUS_LLM_PROVIDER'] = 'ollama';
    _vsCfg['llm.provider'] = 'gemini';
    expect(readGatewayOptions().provider).toBe('gemini');
  });
});

// ── API keys ──────────────────────────────────────────────────────────────────

describe('readGatewayOptions — API keys', () => {
  it('reads anthropic key from VS Code setting', () => {
    _vsCfg['llm.anthropic.apiKey'] = 'sk-ant-test';
    expect(readGatewayOptions().anthropicApiKey).toBe('sk-ant-test');
  });

  it('falls back to ANTHROPIC_API_KEY env', () => {
    process.env['ANTHROPIC_API_KEY'] = 'sk-ant-env';
    expect(readGatewayOptions().anthropicApiKey).toBe('sk-ant-env');
  });

  it('VS Code key overrides ANTHROPIC_API_KEY env', () => {
    process.env['ANTHROPIC_API_KEY'] = 'sk-ant-env';
    _vsCfg['llm.anthropic.apiKey'] = 'sk-ant-settings';
    expect(readGatewayOptions().anthropicApiKey).toBe('sk-ant-settings');
  });

  it('reads gemini key from VS Code setting', () => {
    _vsCfg['llm.gemini.apiKey'] = 'AIza-test';
    expect(readGatewayOptions().geminiApiKey).toBe('AIza-test');
  });

  it('falls back to GEMINI_API_KEY env', () => {
    process.env['GEMINI_API_KEY'] = 'AIza-env';
    expect(readGatewayOptions().geminiApiKey).toBe('AIza-env');
  });
});

// ── Ollama URL & model ────────────────────────────────────────────────────────

describe('readGatewayOptions — Ollama / model', () => {
  it('reads ollama baseUrl from VS Code setting', () => {
    _vsCfg['llm.ollama.baseUrl'] = 'http://192.168.1.5:11434';
    expect(readGatewayOptions().ollamaBaseUrl).toBe('http://192.168.1.5:11434');
  });

  it('falls back to OLLAMA_BASE_URL env', () => {
    process.env['OLLAMA_BASE_URL'] = 'http://remote:11434';
    expect(readGatewayOptions().ollamaBaseUrl).toBe('http://remote:11434');
  });

  it('reads model from VS Code setting', () => {
    _vsCfg['llm.model'] = 'gemini-1.5-pro';
    expect(readGatewayOptions().model).toBe('gemini-1.5-pro');
  });

  it('omits optional fields when not configured', () => {
    const opts = readGatewayOptions();
    expect('model' in opts).toBe(false);
    expect('anthropicApiKey' in opts).toBe(false);
    expect('geminiApiKey' in opts).toBe(false);
    expect('ollamaBaseUrl' in opts).toBe(false);
  });
});

// ── readConfigStatus ──────────────────────────────────────────────────────────

describe('readConfigStatus — anthropic (default)', () => {
  it('isReady is false when no API key configured', () => {
    expect(readConfigStatus().isReady).toBe(false);
  });

  it('provider defaults to anthropic', () => {
    expect(readConfigStatus().provider).toBe('anthropic');
  });

  it('isReady is true when anthropic key set in VS Code settings', () => {
    _vsCfg['llm.anthropic.apiKey'] = 'sk-ant-test';
    expect(readConfigStatus().isReady).toBe(true);
  });

  it('isReady is true when anthropic key set in env', () => {
    process.env['ANTHROPIC_API_KEY'] = 'sk-ant-env';
    expect(readConfigStatus().isReady).toBe(true);
  });

  it('missingHint mentions console.anthropic.com when key absent', () => {
    expect(readConfigStatus().missingHint).toContain('console.anthropic.com');
  });

  it('model is undefined when not set', () => {
    expect(readConfigStatus().model).toBeUndefined();
  });

  it('model reads from VS Code setting', () => {
    _vsCfg['llm.model'] = 'claude-opus-4-6';
    expect(readConfigStatus().model).toBe('claude-opus-4-6');
  });
});

describe('readConfigStatus — gemini provider', () => {
  beforeEach(() => { _vsCfg['llm.provider'] = 'gemini'; });

  it('isReady is false when Gemini key absent', () => {
    expect(readConfigStatus().isReady).toBe(false);
  });

  it('isReady is true when Gemini key set in VS Code settings', () => {
    _vsCfg['llm.gemini.apiKey'] = 'AIza-test';
    expect(readConfigStatus().isReady).toBe(true);
  });

  it('isReady is true when Gemini key set in env', () => {
    process.env['GEMINI_API_KEY'] = 'AIza-env';
    expect(readConfigStatus().isReady).toBe(true);
  });

  it('missingHint mentions aistudio.google.com when key absent', () => {
    expect(readConfigStatus().missingHint).toContain('aistudio.google.com');
  });
});

describe('readConfigStatus — ollama provider', () => {
  beforeEach(() => { _vsCfg['llm.provider'] = 'ollama'; });

  it('isReady is always true (no API key needed)', () => {
    expect(readConfigStatus().isReady).toBe(true);
  });

  it('missingHint is empty string', () => {
    expect(readConfigStatus().missingHint).toBe('');
  });

  it('ollamaUrl defaults to localhost', () => {
    expect(readConfigStatus().ollamaUrl).toBe('http://localhost:11434');
  });

  it('ollamaUrl reads from VS Code setting', () => {
    _vsCfg['llm.ollama.baseUrl'] = 'http://myserver:11434';
    expect(readConfigStatus().ollamaUrl).toBe('http://myserver:11434');
  });

  it('ollamaUrl reads from OLLAMA_BASE_URL env', () => {
    process.env['OLLAMA_BASE_URL'] = 'http://remote:11434';
    expect(readConfigStatus().ollamaUrl).toBe('http://remote:11434');
  });
});
