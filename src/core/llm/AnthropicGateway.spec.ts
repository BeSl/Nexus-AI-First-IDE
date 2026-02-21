/**
 * AnthropicGateway — Unit Tests
 * Mocks @anthropic-ai/sdk entirely — no real API calls, no key required.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock Anthropic SDK ────────────────────────────────────────────────────────

const mockCreate = vi.fn();
const mockStream = vi.fn();

vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: {
      create: mockCreate,
      stream: mockStream,
    },
  })),
}));

import { AnthropicGateway } from './AnthropicGateway.js';

// ── Global mock reset ─────────────────────────────────────────────────────────

beforeEach(() => { vi.clearAllMocks(); });

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeResponse(text: string) {
  return {
    content: [{ type: 'text', text }],
    model: 'claude-sonnet-4-6',
    stop_reason: 'end_turn',
    usage: { input_tokens: 10, output_tokens: 5 },
  };
}

async function* makeStreamEvents(text: string) {
  for (const char of text) {
    yield { type: 'content_block_delta', delta: { type: 'text_delta', text: char } };
  }
  yield { type: 'message_stop' };
}

const MSG = [{ role: 'user' as const, content: 'hello' }];

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('AnthropicGateway.complete', () => {
  let gw: AnthropicGateway;
  beforeEach(() => { gw = new AnthropicGateway({ apiKey: 'test-key' }); vi.clearAllMocks(); });

  it('returns LLMResponse with content', async () => {
    mockCreate.mockResolvedValue(makeResponse('Hello world'));
    const res = await gw.complete(MSG);
    expect(res.content).toBe('Hello world');
    expect(res.model).toBe('claude-sonnet-4-6');
    expect(res.stopReason).toBe('end_turn');
  });

  it('maps token usage correctly', async () => {
    mockCreate.mockResolvedValue(makeResponse('hi'));
    const res = await gw.complete(MSG);
    expect(res.usage.inputTokens).toBe(10);
    expect(res.usage.outputTokens).toBe(5);
    expect(res.usage.totalTokens).toBe(15);
  });

  it('passes system prompt when provided', async () => {
    mockCreate.mockResolvedValue(makeResponse('ok'));
    await gw.complete(MSG, { system: 'You are an architect.' });
    const call = mockCreate.mock.calls[0]?.[0];
    expect(call?.system).toBe('You are an architect.');
  });

  it('passes custom model and maxTokens', async () => {
    mockCreate.mockResolvedValue(makeResponse('ok'));
    await gw.complete(MSG, { model: 'claude-opus-4-6', maxTokens: 1024 });
    const call = mockCreate.mock.calls[0]?.[0];
    expect(call?.model).toBe('claude-opus-4-6');
    expect(call?.max_tokens).toBe(1024);
  });

  it('passes temperature when provided', async () => {
    mockCreate.mockResolvedValue(makeResponse('ok'));
    await gw.complete(MSG, { temperature: 0.2 });
    const call = mockCreate.mock.calls[0]?.[0];
    expect(call?.temperature).toBe(0.2);
  });

  it('passes stop sequences', async () => {
    mockCreate.mockResolvedValue(makeResponse('ok'));
    await gw.complete(MSG, { stopSequences: ['```'] });
    const call = mockCreate.mock.calls[0]?.[0];
    expect(call?.stop_sequences).toEqual(['```']);
  });
});

describe('AnthropicGateway.registerTools', () => {
  it('includes tools in request when registered', async () => {
    const gw = new AnthropicGateway({ apiKey: 'test-key' });
    mockCreate.mockResolvedValue(makeResponse('ok'));

    gw.registerTools([{
      name: 'read_file',
      description: 'Read a file',
      inputSchema: { type: 'object', properties: { path: { type: 'string' } } },
    }]);

    await gw.complete(MSG);
    const call = mockCreate.mock.calls[0]?.[0];
    expect(call?.tools).toHaveLength(1);
    expect(call?.tools[0]?.name).toBe('read_file');
  });
});

describe('AnthropicGateway.stream', () => {
  let gw: AnthropicGateway;
  beforeEach(() => { gw = new AnthropicGateway({ apiKey: 'test-key' }); vi.clearAllMocks(); });

  it('yields text chunks and final done=true', async () => {
    const streamObj = {
      [Symbol.asyncIterator]: () => makeStreamEvents('Hi!'),
      finalMessage: vi.fn().mockResolvedValue({
        usage: { input_tokens: 3, output_tokens: 2 },
      }),
    };
    mockStream.mockReturnValue(streamObj);

    const chunks: import('./LLMGateway.types.js').LLMChunk[] = [];
    for await (const chunk of gw.stream(MSG)) chunks.push(chunk);

    const textChunks = chunks.filter((c) => !c.done);
    expect(textChunks.map((c) => c.delta).join('')).toBe('Hi!');
    expect(chunks.at(-1)?.done).toBe(true);
  });

  it('last chunk includes usage', async () => {
    const streamObj = {
      [Symbol.asyncIterator]: () => makeStreamEvents('ok'),
      finalMessage: vi.fn().mockResolvedValue({
        usage: { input_tokens: 5, output_tokens: 3 },
      }),
    };
    mockStream.mockReturnValue(streamObj);

    const chunks: import('./LLMGateway.types.js').LLMChunk[] = [];
    for await (const chunk of gw.stream(MSG)) chunks.push(chunk);

    const last = chunks.at(-1)!;
    expect(last.usage?.totalTokens).toBe(8);
  });
});
