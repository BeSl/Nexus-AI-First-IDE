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
  vi.spyOn(global, 'fetch').mockResolvedValueOnce({
    ok:   status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body),
    json: async () => body,
    body: null,
  } as unknown as Response);
}

/** Parse the JSON body from the first fetch call in the test. */
function parsedBody() {
  const calls = (global.fetch as ReturnType<typeof vi.fn>).mock.calls as unknown[][];
  return JSON.parse((calls[0]?.[1] as RequestInit).body as string) as Record<string, unknown>;
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
    mockFetch(geminiResp('ok'));
    const gw = new GeminiGateway({ apiKey: 'k' });
    await gw.complete([{ role: 'user', content: 'hi' }], { model: 'gemini-1.5-pro' });
    const url = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as string;
    expect(url).toContain('gemini-1.5-pro');
  });

  it('uses GEMINI_MODEL env as default', async () => {
    process.env['GEMINI_MODEL'] = 'gemini-custom';
    mockFetch(geminiResp('ok'));
    const gw = new GeminiGateway({ apiKey: 'k' });
    await gw.complete([{ role: 'user', content: 'hi' }]);
    const url = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as string;
    expect(url).toContain('gemini-custom');
  });

  it('reads API key from GEMINI_API_KEY env', async () => {
    process.env['GEMINI_API_KEY'] = 'env-key-xyz';
    mockFetch(geminiResp('ok'));
    const gw = new GeminiGateway();
    await gw.complete([{ role: 'user', content: 'hi' }]);
    const url = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as string;
    expect(url).toContain('env-key-xyz');
  });

  it('throws on non-ok response', async () => {
    mockFetch({ error: 'bad request' }, 400);
    const gw = new GeminiGateway({ apiKey: 'k' });
    await expect(gw.complete([{ role: 'user', content: 'hi' }])).rejects.toThrow('Gemini error 400');
  });

  it('injects tools into systemInstruction', async () => {
    mockFetch(geminiResp('ok'));
    const gw = new GeminiGateway({ apiKey: 'k' });
    gw.registerTools([{ name: 'search', description: 'search tool', inputSchema: { query: 'string' } }]);
    await gw.complete([{ role: 'user', content: 'hi' }]);
    const body = parsedBody() as { systemInstruction: { parts: [{ text: string }] } };
    expect(body.systemInstruction?.parts[0]?.text).toContain('search');
  });

  it('maps assistant role to model role', async () => {
    mockFetch(geminiResp('ok'));
    const gw = new GeminiGateway({ apiKey: 'k' });
    await gw.complete([
      { role: 'user',      content: 'hello' },
      { role: 'assistant', content: 'world' },
      { role: 'user',      content: 'again' },
    ]);
    const body = parsedBody() as { contents: Array<{ role: string }> };
    expect(body.contents[1]?.role).toBe('model');
  });

  it('moves system messages to systemInstruction', async () => {
    mockFetch(geminiResp('ok'));
    const gw = new GeminiGateway({ apiKey: 'k' });
    await gw.complete([
      { role: 'system', content: 'You are helpful' },
      { role: 'user',   content: 'hi' },
    ]);
    const body = parsedBody() as {
      systemInstruction: { parts: [{ text: string }] };
      contents: unknown[];
    };
    expect(body.systemInstruction?.parts[0]?.text).toContain('You are helpful');
    expect(body.contents).toHaveLength(1);
  });

  it('always sets responseMimeType to application/json', async () => {
    mockFetch(geminiResp('{"result":1}'));
    const gw = new GeminiGateway({ apiKey: 'k' });
    await gw.complete([{ role: 'user', content: 'give me json' }]);
    const body = parsedBody() as { generationConfig: { responseMimeType: string } };
    expect(body.generationConfig?.responseMimeType).toBe('application/json');
  });

  it('includes BLOCK_ONLY_HIGH safety settings for all harm categories', async () => {
    mockFetch(geminiResp('ok'));
    const gw = new GeminiGateway({ apiKey: 'k' });
    await gw.complete([{ role: 'user', content: 'hi' }]);
    const body = parsedBody() as {
      safetySettings: Array<{ category: string; threshold: string }>;
    };
    expect(body.safetySettings).toHaveLength(4);
    expect(body.safetySettings?.every((s) => s.threshold === 'BLOCK_ONLY_HIGH')).toBe(true);
    const categories = body.safetySettings?.map((s) => s.category);
    expect(categories).toContain('HARM_CATEGORY_HATE_SPEECH');
    expect(categories).toContain('HARM_CATEGORY_DANGEROUS_CONTENT');
    expect(categories).toContain('HARM_CATEGORY_SEXUALLY_EXPLICIT');
    expect(categories).toContain('HARM_CATEGORY_HARASSMENT');
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
