/**
 * GatewayFactory — Unit Tests
 * Verifies provider selection from opts and env variables.
 */

import { describe, it, expect, afterEach } from 'vitest';
import { createGateway } from './GatewayFactory.js';
import { AnthropicGateway } from './AnthropicGateway.js';
import { OllamaGateway } from './OllamaGateway.js';
import { GeminiGateway } from './GeminiGateway.js';

afterEach(() => {
  delete process.env['NEXUS_LLM_PROVIDER'];
});

// ── provider selection via opts ───────────────────────────────────────────────

describe('createGateway — opts.provider', () => {
  it('returns AnthropicGateway for provider=anthropic', () => {
    expect(createGateway({ provider: 'anthropic' })).toBeInstanceOf(AnthropicGateway);
  });

  it('returns OllamaGateway for provider=ollama', () => {
    expect(createGateway({ provider: 'ollama' })).toBeInstanceOf(OllamaGateway);
  });

  it('returns GeminiGateway for provider=gemini', () => {
    expect(createGateway({ provider: 'gemini' })).toBeInstanceOf(GeminiGateway);
  });

  it('defaults to AnthropicGateway when no provider specified', () => {
    expect(createGateway()).toBeInstanceOf(AnthropicGateway);
  });
});

// ── provider selection via env ────────────────────────────────────────────────

describe('createGateway — NEXUS_LLM_PROVIDER env', () => {
  it('reads anthropic from env', () => {
    process.env['NEXUS_LLM_PROVIDER'] = 'anthropic';
    expect(createGateway()).toBeInstanceOf(AnthropicGateway);
  });

  it('reads ollama from env', () => {
    process.env['NEXUS_LLM_PROVIDER'] = 'ollama';
    expect(createGateway()).toBeInstanceOf(OllamaGateway);
  });

  it('reads gemini from env', () => {
    process.env['NEXUS_LLM_PROVIDER'] = 'gemini';
    expect(createGateway()).toBeInstanceOf(GeminiGateway);
  });

  it('opts.provider overrides env', () => {
    process.env['NEXUS_LLM_PROVIDER'] = 'ollama';
    expect(createGateway({ provider: 'anthropic' })).toBeInstanceOf(AnthropicGateway);
  });
});

// ── ILLMGateway interface compliance ─────────────────────────────────────────

describe('createGateway — gateway implements ILLMGateway', () => {
  it('all providers have registerTools method', () => {
    expect(typeof createGateway({ provider: 'anthropic' }).registerTools).toBe('function');
    expect(typeof createGateway({ provider: 'ollama' }).registerTools).toBe('function');
    expect(typeof createGateway({ provider: 'gemini' }).registerTools).toBe('function');
  });

  it('all providers have complete method', () => {
    expect(typeof createGateway({ provider: 'anthropic' }).complete).toBe('function');
    expect(typeof createGateway({ provider: 'ollama' }).complete).toBe('function');
    expect(typeof createGateway({ provider: 'gemini' }).complete).toBe('function');
  });

  it('all providers have stream method', () => {
    expect(typeof createGateway({ provider: 'anthropic' }).stream).toBe('function');
    expect(typeof createGateway({ provider: 'ollama' }).stream).toBe('function');
    expect(typeof createGateway({ provider: 'gemini' }).stream).toBe('function');
  });
});

// ── error handling ────────────────────────────────────────────────────────────

describe('createGateway — unknown provider', () => {
  it('throws for unknown provider string', () => {
    expect(() => createGateway({ provider: 'bedrock' as never })).toThrow('Unknown LLM provider');
  });
});
