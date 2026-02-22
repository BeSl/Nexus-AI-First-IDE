/**
 * OllamaGateway — Unit Tests
 * fetch is mocked via vi.spyOn — no real HTTP calls.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OllamaGateway } from './OllamaGateway.js';

// ── fetch mock helpers ────────────────────────────────────────────────────────

function mockFetch(body: unknown, status = 200) {
  const json   = async () => body;
  const text   = async () => JSON.stringify(body);
  const ok = status >= 200 && status < 300;
  vi.spyOn(global, 'fetch').mockResolvedValueOnce({ ok, status, json, text } as unknown as Response);
}

function mockFetchError(status: number, message: string) {
  vi.spyOn(global, 'fetch').mockResolvedValueOnce({
    ok: false, status,
    text: async () => message,
  } as unknown as Response);
}

function makeOllamaResponse(content: string, done = true) {
  return {
    model: 'codellama',
    message: { role: 'assistant', content },
    done,
    prompt_eval_count: 10,
    eval_count: 20,
  };
}

beforeEach(() => { vi.restoreAllMocks(); });

// ── complete — success ────────────────────────────────────────────────────────

describe('OllamaGateway.complete — success', () => {
  it('returns content from Ollama response', async () => {
    mockFetch(makeOllamaResponse('Hello from Ollama'));
    const gw = new OllamaGateway({ baseUrl: 'http://localhost:11434', model: 'codellama' });
    const result = await gw.complete([{ role: 'user', content: 'hi' }]);
    expect(result.content).toBe('Hello from Ollama');
  });

  it('uses model from opts if provided', async () => {
    mockFetch(makeOllamaResponse('ok'));
    const gw = new OllamaGateway({ baseUrl: 'http://localhost:11434', model: 'codellama' });
    await gw.complete([{ role: 'user', content: 'q' }], { model: 'mistral' });
    const callBody = JSON.parse((vi.mocked(fetch).mock.calls[0]![1] as RequestInit).body as string);
    expect(callBody.model).toBe('mistral');
  });

  it('maps token usage correctly', async () => {
    mockFetch(makeOllamaResponse('answer'));
    const gw = new OllamaGateway({ baseUrl: 'http://localhost:11434' });
    const result = await gw.complete([{ role: 'user', content: 'q' }]);
    expect(result.usage.inputTokens).toBe(10);
    expect(result.usage.outputTokens).toBe(20);
    expect(result.usage.totalTokens).toBe(30);
  });

  it('posts to /api/chat endpoint', async () => {
    mockFetch(makeOllamaResponse('ok'));
    const gw = new OllamaGateway({ baseUrl: 'http://custom:9999', model: 'llama3' });
    await gw.complete([{ role: 'user', content: 'q' }]);
    expect(vi.mocked(fetch).mock.calls[0]![0]).toBe('http://custom:9999/api/chat');
  });

  it('uses OLLAMA_BASE_URL env variable', async () => {
    process.env['OLLAMA_BASE_URL'] = 'http://env-host:1234';
    mockFetch(makeOllamaResponse('ok'));
    const gw = new OllamaGateway();
    await gw.complete([{ role: 'user', content: 'q' }]);
    expect(vi.mocked(fetch).mock.calls[0]![0]).toBe('http://env-host:1234/api/chat');
    delete process.env['OLLAMA_BASE_URL'];
  });

  it('injects system prompt + tools into messages', async () => {
    mockFetch(makeOllamaResponse('ok'));
    const gw = new OllamaGateway({ baseUrl: 'http://localhost:11434' });
    gw.registerTools([{ name: 'ts_diagnostics', description: 'get diags', inputSchema: {} }]);
    await gw.complete(
      [{ role: 'user', content: 'q' }],
      { system: 'You are helpful.' },
    );
    const callBody = JSON.parse((vi.mocked(fetch).mock.calls[0]![1] as RequestInit).body as string);
    const systemMsg = callBody.messages.find((m: { role: string }) => m.role === 'system');
    expect(systemMsg).toBeTruthy();
    expect(systemMsg.content).toContain('ts_diagnostics');
    expect(systemMsg.content).toContain('You are helpful.');
  });
});

// ── complete — errors ─────────────────────────────────────────────────────────

describe('OllamaGateway.complete — errors', () => {
  it('throws on non-200 response', async () => {
    mockFetchError(500, 'Internal Server Error');
    const gw = new OllamaGateway({ baseUrl: 'http://localhost:11434' });
    await expect(gw.complete([{ role: 'user', content: 'q' }])).rejects.toThrow('Ollama error 500');
  });

  it('throws on 404', async () => {
    mockFetchError(404, 'model not found');
    const gw = new OllamaGateway({ baseUrl: 'http://localhost:11434' });
    await expect(gw.complete([{ role: 'user', content: 'q' }])).rejects.toThrow('404');
  });
});

// ── registerTools ─────────────────────────────────────────────────────────────

describe('OllamaGateway.registerTools', () => {
  it('does not throw when registering tools', () => {
    const gw = new OllamaGateway();
    expect(() => gw.registerTools([{ name: 'tool', description: 'd', inputSchema: {} }])).not.toThrow();
  });
});
