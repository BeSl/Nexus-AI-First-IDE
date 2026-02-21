/**
 * LLM Gateway — Type Contracts (Phase 1.3)
 *
 * Stable interface over LLM providers.
 * Swap AnthropicGateway for any other provider without changing callers.
 *
 * MCP (Model Context Protocol) compatible request/response format.
 */

export type MessageRole = 'user' | 'assistant' | 'system';

export interface LLMMessage {
  readonly role: MessageRole;
  readonly content: string;
}

/** Token usage for billing / budget tracking */
export interface TokenUsage {
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly totalTokens: number;
}

/** Non-streaming completion result */
export interface LLMResponse {
  readonly content: string;
  readonly model: string;
  readonly usage: TokenUsage;
  readonly stopReason: 'end_turn' | 'max_tokens' | 'stop_sequence' | string;
}

/** Streaming chunk (for UI progress) */
export interface LLMChunk {
  readonly delta: string;
  readonly done: boolean;
  readonly usage?: TokenUsage;
}

export interface LLMRequestOptions {
  readonly model?: string;
  readonly maxTokens?: number;
  readonly temperature?: number;
  readonly system?: string;
  /** Stop generation at any of these strings */
  readonly stopSequences?: readonly string[];
}

/** MCP-compatible tool definition */
export interface MCPTool {
  readonly name: string;
  readonly description: string;
  readonly inputSchema: Record<string, unknown>;
}

export interface ILLMGateway {
  /**
   * Single-turn completion.
   * @security Never log full messages — may contain secrets.
   */
  complete(
    messages: readonly LLMMessage[],
    opts?: LLMRequestOptions
  ): Promise<LLMResponse>;

  /**
   * Streaming completion — yields chunks for real-time UI.
   */
  stream(
    messages: readonly LLMMessage[],
    opts?: LLMRequestOptions
  ): AsyncIterable<LLMChunk>;

  /** Register MCP tools available to the model */
  registerTools(tools: readonly MCPTool[]): void;
}
