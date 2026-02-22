/**
 * GeminiGateway — Unit Tests
 * Uses vi.spyOn(global, 'fetch') for HTTP isolation.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GeminiGateway } from './GeminiGateway.js';

// ── helpers ───────────────────────────────────────────────────────────────────

function geminiResp(text: string) {
  return {
    candidates: [{ content: { role: 'model', parts: [{ text }] }, finishReason: 'STOP' }],
    usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 5, totalTokenCount: 15 },
  };
}

function mockFetch(body: unknown, status = 200) {
  return vi.spyOn(global, 'fetch').mockResolvedValueOnce({
    ok:   status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body),
    json: async () => body,
    body: null,
  } as unknown as Response);
}

function parsedBody(spy: ReturnType<typeof vi.spyOn>) {
  return JSON.parse((spy.mock.calls[0]?.[1] as RequestInit).body as string) as Record<string, unknown>;
}

beforeEach(() => { vi.restoreAllMocks(); });
afterEach(() => {
  delete process.env['GEMINI_API_KEY'];
  delete process.env['GEMINI_MODEL'];
});

// ── complete ─────────────────────────────────────────────────────────────────

describe('GeminiGateway.complete', () => {
  it('returns content from response', async () => {
    mockFetch(geminiResp('Hello Gemini'));
    const gw = new GeminiGateway({ apiKey: 'test-key' });
    const res = await gw.complete([{ role: 'user', content: 'hi' }]);
    expect(res.content).toBe('Hello Gemini');
  });

  it('includes token usage', async () => {
    mockFetch(geminiResp('ok'));
    const gw = new GeminiGateway({ apiKey: 'test-key' });
    const res = await gw.complete([{ role: 'user', content: 'hi' }]);
    expect(res.usage.inputTokens).toBe(10);
    expect(res.usage.outputTokens).toBe(5);
    expect(res.usage.totalTokens).toBe(15);
  });

  it('uses model from opts', async () => {
    const spy = mockFetch(geminiResp('ok'));
    const gw = new GeminiGateway({ apiKey: 'k' });
    await gw.complete([{ role: 'user', content: 'hi' }], { model: 'gemini-1.5-pro' });
    expect(spy.mock.calls[0]?.[0] as string).toContain('gemini-1.5-pro');
  });

  it('uses GEMINI_MODEL env as default', async () => {
    process.env['GEMINI_MODEL'] = 'gemini-custom';
    const spy = mockFetch(geminiResp('ok'));
    const gw = new GeminiGateway({ apiKey: 'k' });
    await gw.complete([{ role: 'user', content: 'hi' }]);
    expect(spy.mock.calls[0]?.[0] as string).toContain('gemini-custom');
  });

  it('reads API key from GEMINI_API_KEY env', async () => {
    process.env['GEMINI_API_KEY'] = 'env-key-xyz';
    const spy = mockFetch(geminiResp('ok'));
    const gw = new GeminiGateway();
    await gw.complete([{ role: 'user', content: 'hi' }]);
    expect(spy.mock.calls[0]?.[0] as string).toContain('env-key-xyz');
  });

  it('throws on non-ok response', async () => {
    mockFetch({ error: 'bad request' }, 400);
    const gw = new GeminiGateway({ apiKey: 'k' });
    await expect(gw.complete([{ role: 'user', content: 'hi' }])).rejects.toThrow('Gemini error 400');
  });

  it('injects tools into systemInstruction', async () => {
    const spy = mockFetch(geminiResp('ok'));
    const gw = new GeminiGateway({ apiKey: 'k' });
    gw.registerTools([{ name: 'search', description: 'search tool', inputSchema: { query: 'string' } }]);
    await gw.complete([{ role: 'user', content: 'hi' }]);
    const body = parsedBody(spy) as { systemInstruction: { parts: [{ text: string }] } };
    expect(body.systemInstruction?.parts[0]?.text).toContain('search');
  });

  it('maps assistant role to model role', async () => {
    const spy = mockFetch(geminiResp('ok'));
    const gw = new GeminiGateway({ apiKey: 'k' });
    await gw.complete([
      { role: 'user',      content: 'hello' },
      { role: 'assistant', content: 'world' },
      { role: 'user',      content: 'again' },
    ]);
    const body = parsedBody(spy) as { contents: Array<{ role: string }> };
    expect(body.contents[1]?.role).toBe('model');
  });

  it('moves system messages to systemInstruction', async () => {
    const spy = mockFetch(geminiResp('ok'));
    const gw = new GeminiGateway({ apiKey: 'k' });
    await gw.complete([
      { role: 'system', content: 'You are helpful' },
      { role: 'user',   content: 'hi' },
    ]);
    const body = parsedBody(spy) as {
      systemInstruction: { parts: [{ text: string }] };
      contents: unknown[];
    };
    expect(body.systemInstruction?.parts[0]?.text).toContain('You are helpful');
    expect(body.contents).toHaveLength(1);
  });
});

// ── interface compliance ──────────────────────────────────────────────────────

describe('GeminiGateway — ILLMGateway interface', () => {
  it('has complete method', () => {
    expect(typeof new GeminiGateway({ apiKey: 'k' }).complete).toBe('function');
  });

  it('has stream method', () => {
    expect(typeof new GeminiGateway({ apiKey: 'k' }).stream).toBe('function');
  });

  it('has registerTools method', () => {
    expect(typeof new GeminiGateway({ apiKey: 'k' }).registerTools).toBe('function');
  });
});
