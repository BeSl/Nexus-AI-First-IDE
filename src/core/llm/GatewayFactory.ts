/**
 * GatewayFactory — LLM Provider Selector
 *
 * Reads NEXUS_LLM_PROVIDER env variable and returns the appropriate
 * ILLMGateway implementation. Agents remain model-agnostic.
 *
 * Supported providers:
 *   anthropic          — Claude via Anthropic API (default)
 *   ollama             — Local Ollama server (no external calls)
 *   gemini             — Google Gemini REST API
 *   openai-compatible  — Any OpenAI API compatible endpoint (OpenAI, Azure, OpenRouter, etc.)
 *
 * @security API keys come from env variables only. Never pass from user input.
 */

import { AnthropicGateway } from './AnthropicGateway.js';
import { OllamaGateway } from './OllamaGateway.js';
import { GeminiGateway } from './GeminiGateway.js';
import { OpenAICompatibleGateway } from './OpenAICompatibleGateway.js';
import type { ILLMGateway } from './LLMGateway.types.js';

export type LlmProvider = 'anthropic' | 'ollama' | 'gemini' | 'openai-compatible';

export interface GatewayOptions {
  /** Override provider (default: NEXUS_LLM_PROVIDER env, fallback 'anthropic') */
  readonly provider?: LlmProvider;
  /** Anthropic-specific API key override (default: ANTHROPIC_API_KEY env) */
  readonly anthropicApiKey?: string;
  /** Ollama-specific base URL override (default: OLLAMA_BASE_URL env) */
  readonly ollamaBaseUrl?: string;
  /** Gemini-specific API key override (default: GEMINI_API_KEY env) */
  readonly geminiApiKey?: string;
  /** OpenAI-compatible API key override (default: OPENAI_API_KEY env) */
  readonly openaiApiKey?: string;
  /** OpenAI-compatible base URL override (default: OPENAI_BASE_URL env, fallback https://api.openai.com/v1) */
  readonly openaiBaseUrl?: string;
  /** Model name override */
  readonly model?: string;
}

/**
 * Create an ILLMGateway for the configured provider.
 * Throws if an unknown provider is specified.
 */
export function createGateway(opts: GatewayOptions = {}): ILLMGateway {
  const provider: LlmProvider = opts.provider
    ?? (process.env['NEXUS_LLM_PROVIDER'] as LlmProvider | undefined)
    ?? 'anthropic';

  switch (provider) {
    case 'anthropic':
      return new AnthropicGateway({
        ...(opts.anthropicApiKey ? { apiKey: opts.anthropicApiKey } : {}),
        ...(opts.model ? { model: opts.model } : {}),
      });

    case 'ollama':
      return new OllamaGateway({
        ...(opts.ollamaBaseUrl ? { baseUrl: opts.ollamaBaseUrl } : {}),
        ...(opts.model ? { model: opts.model } : {}),
      });

    case 'gemini':
      return new GeminiGateway({
        ...(opts.geminiApiKey ? { apiKey: opts.geminiApiKey } : {}),
        ...(opts.model ? { model: opts.model } : {}),
      });

    case 'openai-compatible':
      return new OpenAICompatibleGateway({
        ...(opts.openaiBaseUrl ? { baseUrl: opts.openaiBaseUrl } : {}),
        ...(opts.openaiApiKey ? { apiKey: opts.openaiApiKey } : {}),
        ...(opts.model ? { model: opts.model } : {}),
      });

    default: {
      const exhaustive: never = provider;
      throw new Error(`Unknown LLM provider: ${String(exhaustive)}`);
    }
  }
}
