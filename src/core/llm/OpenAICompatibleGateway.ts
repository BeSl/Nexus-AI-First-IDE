/**
 * OpenAICompatibleGateway — ILLMGateway over any OpenAI API compatible endpoint
 *
 * Supports any LLM provider that implements the OpenAI Chat Completions API:
 *   - OpenAI itself (api.openai.com)
 *   - OpenRouter (openrouter.ai)
 *   - Azure OpenAI
 *   - Cohere, Mistral, Perplexity, and other compatible APIs
 *   - Local servers (llama.cpp, vLLM, Text Generation WebUI, etc.)
 *
 * Config (via env or constructor):
 *   OPENAI_API_KEY  — API key (optional for some local endpoints)
 *   OPENAI_BASE_URL — base URL for the API (default: https://api.openai.com/v1)
 *   OPENAI_MODEL    — default model name
 *
 * @security API key from env only. Never accept from user-controlled input.
 */

import type {
  ILLMGateway,
  LLMMessage,
  LLMResponse,
  LLMChunk,
  LLMRequestOptions,
  MCPTool,
  TokenUsage,
} from './LLMGateway.types.js';

// ── OpenAI-compatible wire types ─────────────────────────────────────────────

interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  name?: string;
  tool_call_id?: string;
}

interface OpenAIRequest {
  model: string;
  messages: OpenAIMessage[];
  temperature?: number;
  max_tokens?: number;
  stop?: string | string[];
  stream?: boolean;
  tools?: unknown[];
}

interface OpenAIToolChoice {
  type: 'function';
  function: { name: string };
}

interface OpenAIResponse {
  id: string;
  model: string;
  choices: Array<{
    index: number;
    message: { role: string; content: string; tool_calls?: Array<{ id: string; type: string; function: { name: string; arguments: string } }> };
    finish_reason: string | null;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

interface OpenAIStreamChunk {
  id: string;
  model: string;
  choices: Array<{
    index: number;
    delta: { content?: string; role?: string; tool_calls?: Array<{ id: string; type: string; function: { name: string; arguments: string } }> };
    finish_reason: string | null;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

// ── Implementation ────────────────────────────────────────────────────────────

export class OpenAICompatibleGateway implements ILLMGateway {
  readonly #baseUrl: string;
  readonly #apiKey: string;
  readonly #defaultModel: string;
  #tools: MCPTool[] = [];

  constructor(opts?: { baseUrl?: string; apiKey?: string; model?: string }) {
    this.#baseUrl = opts?.baseUrl
      ?? process.env['OPENAI_BASE_URL']
      ?? 'https://api.openai.com/v1';
    this.#apiKey = opts?.apiKey
      ?? process.env['OPENAI_API_KEY']
      ?? '';
    this.#defaultModel = opts?.model
      ?? process.env['OPENAI_MODEL']
      ?? 'gpt-4';
  }

  registerTools(tools: readonly MCPTool[]): void {
    this.#tools = [...tools];
  }

  async complete(
    messages: readonly LLMMessage[],
    opts: LLMRequestOptions = {},
  ): Promise<LLMResponse> {
    const model = opts.model ?? this.#defaultModel;
    const body = this.#buildBody(messages, opts, false);

    const resp = await fetch(`${this.#baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        ...(this.#apiKey ? { 'Authorization': `Bearer ${this.#apiKey}` } : {}),
      },
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      throw new Error(`OpenAICompatible error ${resp.status}: ${errText}`);
    }

    const data = await resp.json() as OpenAIResponse;
    return toResponse(data);
  }

  async *stream(
    messages: readonly LLMMessage[],
    opts: LLMRequestOptions = {},
  ): AsyncIterable<LLMChunk> {
    const body = this.#buildBody(messages, opts, true);

    const resp = await fetch(`${this.#baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        ...(this.#apiKey ? { 'Authorization': `Bearer ${this.#apiKey}` } : {}),
      },
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      throw new Error(`OpenAICompatible stream error ${resp.status}: ${errText}`);
    }

    const reader = resp.body?.getReader();
    if (!reader) return;

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const json = line.slice(6).trim();
        if (!json || json === '[DONE]') continue;

        const chunk = JSON.parse(json) as OpenAIStreamChunk;
        const delta = chunk.choices?.[0]?.delta?.content ?? '';
        const finish = chunk.choices?.[0]?.finish_reason;
        const isDone = finish === 'stop' || finish === 'length';
        const usage = chunk.usage ? toUsage(chunk.usage) : undefined;
        
        yield { delta, done: isDone, ...(usage ? { usage } : {}) };
        if (isDone) return;
      }
    }
  }

  // ── Private ────────────────────────────────────────────────────────────────

  #buildBody(messages: readonly LLMMessage[], opts: LLMRequestOptions, stream: boolean): OpenAIRequest {
    const mapped = this.#mapMessages(messages, opts);
    return {
      model: opts.model ?? this.#defaultModel,
      messages: mapped,
      ...(opts.temperature !== undefined ? { temperature: opts.temperature } : {}),
      ...(opts.maxTokens !== undefined ? { max_tokens: opts.maxTokens } : {}),
      ...(opts.stopSequences?.length ? { stop: [...opts.stopSequences] } : {}),
      stream,
      ...(this.#tools.length ? { tools: this.#tools } : {}),
    };
  }

  #mapMessages(messages: readonly LLMMessage[], opts: LLMRequestOptions): OpenAIMessage[] {
    const result: OpenAIMessage[] = [];

    // Inject system prompt + tools schema as first system message
    const toolsNote = this.#tools.length
      ? `\n\nAvailable tools (JSON Schema):\n${JSON.stringify(this.#tools, null, 2)}`
      : '';
    const systemContent = (opts.system ?? '') + toolsNote;
    if (systemContent.trim()) {
      result.push({ role: 'system', content: systemContent });
    }

    for (const m of messages) {
      if (m.role === 'system') {
        // Combine with existing system content
        if (result.length > 0 && result[0]!.role === 'system') {
          result[0]!.content += '\n\n' + m.content;
        } else {
          result.push({ role: 'system', content: m.content });
        }
      } else {
        result.push({ role: m.role, content: m.content });
      }
    }
    return result;
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function toResponse(data: OpenAIResponse): LLMResponse {
  const choice = data.choices?.[0];
  const msg = choice?.message;
  const finish = choice?.finish_reason;

  return {
    content: msg?.content ?? '',
    model: data.model,
    stopReason: finish === 'length' ? 'max_tokens' : 'end_turn',
    usage: data.usage ? toUsage(data.usage) : { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
  };
}

function toUsage(u: { prompt_tokens: number; completion_tokens: number; total_tokens: number }): TokenUsage {
  return {
    inputTokens: u.prompt_tokens,
    outputTokens: u.completion_tokens,
    totalTokens: u.total_tokens,
  };
}
