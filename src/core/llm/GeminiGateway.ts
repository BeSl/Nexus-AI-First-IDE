/**
 * GeminiGateway — ILLMGateway over Google Gemini REST API
 *
 * Uses the Gemini Developer API (v1beta) with Node.js built-in fetch.
 * No Google SDK required — keeps the dependency tree minimal.
 *
 * Config (via env or constructor):
 *   GEMINI_API_KEY  — required; no default fallback
 *   GEMINI_MODEL    — default: gemini-2.0-flash
 *
 * Tool use: injected into systemInstruction as JSON schema, matching
 * the same pattern used by OllamaGateway for consistency.
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

// ── Gemini wire types ─────────────────────────────────────────────────────────

interface GeminiPart    { text: string }
interface GeminiContent { role: 'user' | 'model'; parts: GeminiPart[] }

type HarmCategory =
  | 'HARM_CATEGORY_HATE_SPEECH'
  | 'HARM_CATEGORY_DANGEROUS_CONTENT'
  | 'HARM_CATEGORY_SEXUALLY_EXPLICIT'
  | 'HARM_CATEGORY_HARASSMENT';

interface GeminiSafetySetting {
  category: HarmCategory;
  threshold: 'BLOCK_ONLY_HIGH';
}

const SAFETY_SETTINGS: GeminiSafetySetting[] = [
  { category: 'HARM_CATEGORY_HATE_SPEECH',        threshold: 'BLOCK_ONLY_HIGH' },
  { category: 'HARM_CATEGORY_DANGEROUS_CONTENT',  threshold: 'BLOCK_ONLY_HIGH' },
  { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',  threshold: 'BLOCK_ONLY_HIGH' },
  { category: 'HARM_CATEGORY_HARASSMENT',         threshold: 'BLOCK_ONLY_HIGH' },
];

interface GeminiRequest {
  systemInstruction?: { parts: GeminiPart[] };
  contents: GeminiContent[];
  generationConfig?: {
    temperature?: number;
    maxOutputTokens?: number;
    stopSequences?: string[];
    responseMimeType?: string;
  };
  safetySettings?: GeminiSafetySetting[];
}

interface GeminiCandidate {
  content: GeminiContent;
  finishReason?: string;
}

interface GeminiUsageMeta {
  promptTokenCount?: number;
  candidatesTokenCount?: number;
  totalTokenCount?: number;
}

interface GeminiResponse {
  candidates?: GeminiCandidate[];
  usageMetadata?: GeminiUsageMeta;
}

const BASE_URL = 'https://generativelanguage.googleapis.com';

// ── Implementation ────────────────────────────────────────────────────────────

export class GeminiGateway implements ILLMGateway {
  readonly #apiKey: string;
  readonly #defaultModel: string;
  #tools: MCPTool[] = [];

  constructor(opts?: { apiKey?: string; model?: string }) {
    this.#apiKey = opts?.apiKey
      ?? process.env['GEMINI_API_KEY']
      ?? '';
    this.#defaultModel = opts?.model
      ?? process.env['GEMINI_MODEL']
      ?? 'gemini-2.0-flash';
  }

  registerTools(tools: readonly MCPTool[]): void {
    this.#tools = [...tools];
  }

  async complete(
    messages: readonly LLMMessage[],
    opts: LLMRequestOptions = {},
  ): Promise<LLMResponse> {
    const model = opts.model ?? this.#defaultModel;
    const url = `${BASE_URL}/v1beta/models/${model}:generateContent?key=${this.#apiKey}`;
    const body = this.#buildRequest(messages, opts);

    const resp = await fetch(url, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(body),
    });

    if (!resp.ok) {
      throw new Error(`Gemini error ${resp.status}: ${await resp.text()}`);
    }

    const data = await resp.json() as GeminiResponse;
    return toResponse(data, model);
  }

  async *stream(
    messages: readonly LLMMessage[],
    opts: LLMRequestOptions = {},
  ): AsyncIterable<LLMChunk> {
    const model = opts.model ?? this.#defaultModel;
    const url =
      `${BASE_URL}/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${this.#apiKey}`;
    const body = this.#buildRequest(messages, opts);

    const resp = await fetch(url, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(body),
    });

    if (!resp.ok) {
      throw new Error(`Gemini stream error ${resp.status}: ${await resp.text()}`);
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

        const chunk = JSON.parse(json) as GeminiResponse;
        const text    = chunk.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
        const finish  = chunk.candidates?.[0]?.finishReason;
        const isDone  = finish === 'STOP' || finish === 'MAX_TOKENS';
        const usage   = chunk.usageMetadata ? toUsage(chunk.usageMetadata) : undefined;
        yield { delta: text, done: isDone, ...(usage ? { usage } : {}) };
        if (isDone) return;
      }
    }
  }

  // ── Private ────────────────────────────────────────────────────────────────

  #buildRequest(messages: readonly LLMMessage[], opts: LLMRequestOptions): GeminiRequest {
    const toolsNote = this.#tools.length
      ? `\n\nAvailable tools (JSON Schema):\n${JSON.stringify(this.#tools, null, 2)}`
      : '';

    // Collect system content from opts.system and system-role messages
    const sysParts = [
      ...(opts.system ? [opts.system] : []),
      ...messages.filter((m) => m.role === 'system').map((m) => m.content),
      ...(toolsNote ? [toolsNote] : []),
    ];

    // Map non-system messages; Gemini uses 'model' not 'assistant'
    const contents: GeminiContent[] = messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        role:  m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      }));

    const req: GeminiRequest = { contents };

    const sysText = sysParts.join('\n\n');
    if (sysText.trim()) {
      req.systemInstruction = { parts: [{ text: sysText }] };
    }

    const config: GeminiRequest['generationConfig'] = {
      responseMimeType: 'application/json',
    };
    if (opts.temperature !== undefined) config.temperature = opts.temperature;
    if (opts.maxTokens)                 config.maxOutputTokens = opts.maxTokens;
    if (opts.stopSequences?.length)     config.stopSequences = [...opts.stopSequences];
    req.generationConfig = config;
    req.safetySettings = SAFETY_SETTINGS;

    return req;
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function toResponse(data: GeminiResponse, model: string): LLMResponse {
  const text   = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  const finish = data.candidates?.[0]?.finishReason;
  return {
    content:    text,
    model,
    stopReason: finish === 'MAX_TOKENS' ? 'max_tokens' : 'end_turn',
    usage:      toUsage(data.usageMetadata),
  };
}

function toUsage(meta?: GeminiUsageMeta): TokenUsage {
  const i = meta?.promptTokenCount      ?? 0;
  const o = meta?.candidatesTokenCount  ?? 0;
  return { inputTokens: i, outputTokens: o, totalTokens: i + o };
}
