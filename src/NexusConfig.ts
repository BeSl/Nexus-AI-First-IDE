/**
 * NexusConfig — VS Code settings reader
 *
 * Reads nexus.llm.* configuration from VS Code workspace settings.
 * Falls back to environment variables for CI / headless contexts.
 *
 * Priority: VS Code setting → env variable → built-in default
 *
 * @security API keys are stored in VS Code settings (encrypted at rest on macOS/Win).
 *           Never log or expose resolved keys.
 */

import * as vscode from 'vscode';
import type { GatewayOptions, LlmProvider } from './core/llm/GatewayFactory.js';

export interface NexusConfigStatus {
  provider: LlmProvider;
  model: string | undefined;
  apiKeyConfigured: boolean;
  ollamaUrl: string;
  /** true when the extension is ready to call the LLM */
  isReady: boolean;
  /** Human-readable hint shown when isReady === false */
  missingHint: string;
}

const SECTION = 'nexus';

/** Read a nexus.* workspace setting, returning undefined when empty. */
function get(key: string): string | undefined {
  const val = vscode.workspace.getConfiguration(SECTION).get<string>(key);
  return val?.trim() || undefined;
}

/**
 * Returns the current configuration health for UI display.
 * Does NOT expose key values — only presence checks.
 */
export function readConfigStatus(): NexusConfigStatus {
  const provider = (
    get('llm.provider') ?? process.env['NEXUS_LLM_PROVIDER'] ?? 'anthropic'
  ) as LlmProvider;

  const model     = get('llm.model') ?? process.env['OLLAMA_MODEL'];
  const ollamaUrl = get('llm.ollama.baseUrl') ?? process.env['OLLAMA_BASE_URL'] ?? 'http://localhost:11434';

  let apiKeyConfigured = false;
  let missingHint = '';

  if (provider === 'anthropic') {
    apiKeyConfigured = !!(get('llm.anthropic.apiKey') ?? process.env['ANTHROPIC_API_KEY']);
    if (!apiKeyConfigured)
      missingHint = 'Add Anthropic API key in Settings → nexus.llm.anthropic.apiKey (console.anthropic.com)';
  } else if (provider === 'gemini') {
    apiKeyConfigured = !!(get('llm.gemini.apiKey') ?? process.env['GEMINI_API_KEY']);
    if (!apiKeyConfigured)
      missingHint = 'Add Gemini API key in Settings → nexus.llm.gemini.apiKey (aistudio.google.com/apikey)';
  } else {
    apiKeyConfigured = true; // Ollama needs no key
  }

  return { provider, model, apiKeyConfigured, ollamaUrl, isReady: apiKeyConfigured, missingHint };
}

/**
 * Build GatewayOptions from VS Code settings + env variable fallbacks.
 * Safe to call on every agent invocation — VS Code config reads are synchronous.
 */
export function readGatewayOptions(): GatewayOptions {
  const provider = (
    get('llm.provider') ??
    process.env['NEXUS_LLM_PROVIDER'] ??
    'anthropic'
  ) as LlmProvider;

  const model          = get('llm.model')          ?? process.env['OLLAMA_MODEL'];
  const anthropicApiKey = get('llm.anthropic.apiKey') ?? process.env['ANTHROPIC_API_KEY'];
  const geminiApiKey   = get('llm.gemini.apiKey')   ?? process.env['GEMINI_API_KEY'];
  const ollamaBaseUrl  = get('llm.ollama.baseUrl')  ?? process.env['OLLAMA_BASE_URL'];

  return {
    provider,
    ...(model           ? { model }           : {}),
    ...(anthropicApiKey ? { anthropicApiKey } : {}),
    ...(geminiApiKey    ? { geminiApiKey }    : {}),
    ...(ollamaBaseUrl   ? { ollamaBaseUrl }   : {}),
  };
}
