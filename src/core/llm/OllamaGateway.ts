/**
 * OllamaGateway — ILLMGateway over local Ollama REST API
 *
 * Enables fully offline / local model usage. No external SDK required:
 * uses Node.js built-in fetch (≥18) against the Ollama HTTP server.
 *
 * Config (via env or constructor):
 *   OLLAMA_BASE_URL  — default: http://localhost:11434
 *   OLLAMA_MODEL     — default: codellama
 *
 * Tool use: Ollama models with native tool support (llama3.1+, mistral-nemo)
 * encode tools in the system prompt as JSON schema — injected automatically.
 *
 * @security No secrets transmitted. All data stays on localhost.
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

// ── Ollama wire types ─────────────────────────────────────────────────────────

interface OllamaMessage { role: string; content: string }

interface OllamaResponse {
  model: string;
  message: OllamaMessage;
  done: boolean;
  prompt_eval_count?: number;
  eval_count?: number;
}

// ── Implementation ────────────────────────────────────────────────────────────

export class OllamaGateway implements ILLMGateway {
  readonly #baseUrl: string;
  readonly #defaultModel: string;
  #tools: MCPTool[] = [];

  constructor(opts?: { baseUrl?: string; model?: string }) {
    this.#baseUrl = opts?.baseUrl
      ?? process.env['OLLAMA_BASE_URL']
      ?? 'http://localhost:11434';
    this.#defaultModel = opts?.model
      ?? process.env['OLLAMA_MODEL']
      ?? 'codellama';
  }

  registerTools(tools: readonly MCPTool[]): void {
    this.#tools = [...tools];
  }

  async complete(
    messages: readonly LLMMessage[],
    opts: LLMRequestOptions = {},
  ): Promise<LLMResponse> {
    const body = this.#buildBody(messages, opts, false);
    const resp = await fetch(`${this.#baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      throw new Error(`Ollama error ${resp.status}: ${await resp.text()}`);
    }

    const data = await resp.json() as OllamaResponse;
    return toResponse(data, opts.model ?? this.#defaultModel);
  }

  async *stream(
    messages: readonly LLMMessage[],
    opts: LLMRequestOptions = {},
  ): AsyncIterable<LLMChunk> {
    const body = this.#buildBody(messages, opts, true);
    const resp = await fetch(`${this.#baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      throw new Error(`Ollama stream error ${resp.status}: ${await resp.text()}`);
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
        if (!line.trim()) continue;
        const chunk = JSON.parse(line) as OllamaResponse;
        const usage: TokenUsage | undefined = chunk.done
          ? toUsage(chunk.prompt_eval_count, chunk.eval_count)
          : undefined;
        yield { delta: chunk.message?.content ?? '', done: chunk.done, ...(usage ? { usage } : {}) };
        if (chunk.done) return;
      }
    }
  }

  // ── Private ────────────────────────────────────────────────────────────────

  #buildBody(messages: readonly LLMMessage[], opts: LLMRequestOptions, stream: boolean) {
    const mapped = this.#mapMessages(messages, opts);
    return {
      model:    opts.model ?? this.#defaultModel,
      messages: mapped,
      stream,
      options: {
        ...(opts.temperature !== undefined ? { temperature: opts.temperature } : {}),
        ...(opts.maxTokens ? { num_predict: opts.maxTokens } : {}),
        ...(opts.stopSequences?.length ? { stop: [...opts.stopSequences] } : {}),
      },
    };
  }

  #mapMessages(messages: readonly LLMMessage[], opts: LLMRequestOptions): OllamaMessage[] {
    const result: OllamaMessage[] = [];

    // Inject system prompt + tools schema as first system message
    const toolsNote = this.#tools.length
      ? `\n\nAvailable tools (JSON Schema):\n${JSON.stringify(this.#tools, null, 2)}`
      : '';
    const systemContent = (opts.system ?? '') + toolsNote;
    if (systemContent.trim()) {
      result.push({ role: 'system', content: systemContent });
    }

    for (const m of messages) {
      if (m.role !== 'system') result.push({ role: m.role, content: m.content });
    }
    return result;
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function toResponse(data: OllamaResponse, model: string): LLMResponse {
  return {
    content:    data.message.content,
    model:      data.model ?? model,
    stopReason: data.done ? 'end_turn' : 'stop_sequence',
    usage:      toUsage(data.prompt_eval_count, data.eval_count),
  };
}

function toUsage(input?: number, output?: number): TokenUsage {
  const i = input ?? 0;
  const o = output ?? 0;
  return { inputTokens: i, outputTokens: o, totalTokens: i + o };
}
