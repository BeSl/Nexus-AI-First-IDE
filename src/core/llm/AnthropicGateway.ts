/**
 * AnthropicGateway — ILLMGateway over @anthropic-ai/sdk
 *
 * Wraps Anthropic Messages API with:
 *   - Automatic retry on 529 (overloaded)
 *   - MCP tool registration
 *   - Streaming support via AsyncIterator
 *
 * @security API key from env only. Never accept from agent input.
 *           No request/response logging to avoid secret leakage.
 */

import Anthropic from '@anthropic-ai/sdk';
import type {
  ILLMGateway,
  LLMMessage,
  LLMResponse,
  LLMChunk,
  LLMRequestOptions,
  MCPTool,
  TokenUsage,
} from './LLMGateway.types.js';

const DEFAULT_MODEL = 'claude-sonnet-4-6';
const DEFAULT_MAX_TOKENS = 8192;

export class AnthropicGateway implements ILLMGateway {
  readonly #client: Anthropic;
  readonly #defaultOpts: Required<Pick<LLMRequestOptions, 'model' | 'maxTokens'>>;
  #tools: MCPTool[] = [];

  constructor(opts?: { apiKey?: string; model?: string; maxTokens?: number }) {
    this.#client = new Anthropic({
      apiKey: opts?.apiKey ?? process.env['ANTHROPIC_API_KEY'],
    });
    this.#defaultOpts = {
      model: opts?.model ?? DEFAULT_MODEL,
      maxTokens: opts?.maxTokens ?? DEFAULT_MAX_TOKENS,
    };
  }

  registerTools(tools: readonly MCPTool[]): void {
    this.#tools = [...tools];
  }

  async complete(
    messages: readonly LLMMessage[],
    opts: LLMRequestOptions = {}
  ): Promise<LLMResponse> {
    const req = this.#buildRequest(messages, opts);
    const resp = await this.#client.messages.create({ ...req, stream: false });

    const content = resp.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('');

    return {
      content,
      model: resp.model,
      stopReason: resp.stop_reason ?? 'end_turn',
      usage: toUsage(resp.usage),
    };
  }

  async *stream(
    messages: readonly LLMMessage[],
    opts: LLMRequestOptions = {}
  ): AsyncIterable<LLMChunk> {
    const req = this.#buildRequest(messages, opts);
    const stream = this.#client.messages.stream(req);

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        yield { delta: event.delta.text, done: false };
      }
      if (event.type === 'message_stop') {
        const finalMsg = await stream.finalMessage();
        yield { delta: '', done: true, usage: toUsage(finalMsg.usage) };
      }
    }
  }

  // ── Private ────────────────────────────────────────────────────────────────

  #buildRequest(messages: readonly LLMMessage[], opts: LLMRequestOptions) {
    return {
      model: opts.model ?? this.#defaultOpts.model,
      max_tokens: opts.maxTokens ?? this.#defaultOpts.maxTokens,
      messages: messages.map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
      ...(opts.system ? { system: opts.system } : {}),
      ...(opts.temperature !== undefined ? { temperature: opts.temperature } : {}),
      ...(opts.stopSequences?.length ? { stop_sequences: [...opts.stopSequences] } : {}),
      ...(this.#tools.length ? {
        tools: this.#tools.map((t) => ({
          name: t.name,
          description: t.description,
          input_schema: { type: 'object' as const, ...t.inputSchema },
        })),
      } : {}),
    };
  }
}

function toUsage(u: { input_tokens: number; output_tokens: number }): TokenUsage {
  return {
    inputTokens: u.input_tokens,
    outputTokens: u.output_tokens,
    totalTokens: u.input_tokens + u.output_tokens,
  };
}
