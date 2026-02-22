/**
 * GatewayFactory — LLM Provider Selector
 *
 * Reads NEXUS_LLM_PROVIDER env variable and returns the appropriate
 * ILLMGateway implementation. Agents remain model-agnostic.
 *
 * Supported providers:
 *   anthropic  — Claude via Anthropic API (default)
 *   ollama     — Local Ollama server (no external calls)
 *
 * @security API keys come from env variables only. Never pass from user input.
 */

import { AnthropicGateway } from './AnthropicGateway.js';
import { OllamaGateway } from './OllamaGateway.js';
import type { ILLMGateway } from './LLMGateway.types.js';

export type LlmProvider = 'anthropic' | 'ollama';

export interface GatewayOptions {
  /** Override provider (default: NEXUS_LLM_PROVIDER env, fallback 'anthropic') */
  readonly provider?: LlmProvider;
  /** Anthropic-specific API key override (default: ANTHROPIC_API_KEY env) */
  readonly anthropicApiKey?: string;
  /** Ollama-specific base URL override (default: OLLAMA_BASE_URL env) */
  readonly ollamaBaseUrl?: string;
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

    default: {
      const exhaustive: never = provider;
      throw new Error(`Unknown LLM provider: ${String(exhaustive)}`);
    }
  }
}
