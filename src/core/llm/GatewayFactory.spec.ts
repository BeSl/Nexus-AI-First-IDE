/**
 * GatewayFactory — Unit Tests
 * Verifies provider selection from opts and env variables.
 */

import { describe, it, expect, afterEach } from 'vitest';
import { createGateway } from './GatewayFactory.js';
import { AnthropicGateway } from './AnthropicGateway.js';
import { OllamaGateway } from './OllamaGateway.js';

afterEach(() => {
  delete process.env['NEXUS_LLM_PROVIDER'];
});

// ── provider selection via opts ───────────────────────────────────────────────

describe('createGateway — opts.provider', () => {
  it('returns AnthropicGateway for provider=anthropic', () => {
    const gw = createGateway({ provider: 'anthropic' });
    expect(gw).toBeInstanceOf(AnthropicGateway);
  });

  it('returns OllamaGateway for provider=ollama', () => {
    const gw = createGateway({ provider: 'ollama' });
    expect(gw).toBeInstanceOf(OllamaGateway);
  });

  it('defaults to AnthropicGateway when no provider specified', () => {
    const gw = createGateway();
    expect(gw).toBeInstanceOf(AnthropicGateway);
  });
});

// ── provider selection via env ────────────────────────────────────────────────

describe('createGateway — NEXUS_LLM_PROVIDER env', () => {
  it('reads anthropic from env', () => {
    process.env['NEXUS_LLM_PROVIDER'] = 'anthropic';
    const gw = createGateway();
    expect(gw).toBeInstanceOf(AnthropicGateway);
  });

  it('reads ollama from env', () => {
    process.env['NEXUS_LLM_PROVIDER'] = 'ollama';
    const gw = createGateway();
    expect(gw).toBeInstanceOf(OllamaGateway);
  });

  it('opts.provider overrides env', () => {
    process.env['NEXUS_LLM_PROVIDER'] = 'ollama';
    const gw = createGateway({ provider: 'anthropic' });
    expect(gw).toBeInstanceOf(AnthropicGateway);
  });
});

// ── options forwarding ────────────────────────────────────────────────────────

describe('createGateway — gateway implements ILLMGateway', () => {
  it('anthropic gateway has registerTools method', () => {
    const gw = createGateway({ provider: 'anthropic' });
    expect(typeof gw.registerTools).toBe('function');
  });

  it('ollama gateway has registerTools method', () => {
    const gw = createGateway({ provider: 'ollama' });
    expect(typeof gw.registerTools).toBe('function');
  });

  it('both gateways have complete method', () => {
    expect(typeof createGateway({ provider: 'anthropic' }).complete).toBe('function');
    expect(typeof createGateway({ provider: 'ollama' }).complete).toBe('function');
  });

  it('both gateways have stream method', () => {
    expect(typeof createGateway({ provider: 'anthropic' }).stream).toBe('function');
    expect(typeof createGateway({ provider: 'ollama' }).stream).toBe('function');
  });
});

// ── error handling ────────────────────────────────────────────────────────────

describe('createGateway — unknown provider', () => {
  it('throws for unknown provider string', () => {
    expect(() => createGateway({ provider: 'gemini' as never })).toThrow('Unknown LLM provider');
  });
});
