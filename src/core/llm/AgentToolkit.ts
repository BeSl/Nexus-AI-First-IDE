/**
 * AgentToolkit — MCP Tool Dispatcher
 *
 * Exposes ContextEngine, VectorIndex, and SkeletonProvider as MCP tools
 * so Claude can search code and request skeletons autonomously.
 *
 * Tool lifecycle:
 *   1. getTools() → register with ILLMGateway.registerTools()
 *   2. Claude calls tool_use → caller passes name+input to dispatch()
 *   3. dispatch() returns ToolCallResult → caller sends as tool_result
 *
 * @security All tools are READ-ONLY. No file mutations allowed.
 */

import type { IContextEngine } from '../../../core/context-engine.types.js';
import type { IVectorIndex } from '../context/VectorIndex.types.js';
import type { ISkeletonProvider } from '../context/SkeletonProvider.types.js';
import type { MCPTool } from './LLMGateway.types.js';
import type { IAgentToolkit, ToolCallResult } from './AgentToolkit.types.js';

// ── Tool schemas ──────────────────────────────────────────────────────────────

const TOOLS: readonly MCPTool[] = [
  {
    name: 'context_query',
    description:
      'Query the project Context Engine. Returns file skeletons (signatures only, no bodies) ' +
      'ranked by relevance to the intent. Use this before reading any file.',
    inputSchema: {
      type: 'object',
      properties: {
        intent:   { type: 'string', description: 'Natural-language description of what you need' },
        scope:    { type: 'array', items: { type: 'string' }, description: 'Optional: limit to these directory prefixes' },
        maxTokens:{ type: 'number', description: 'Token budget (default: 3000)' },
        topK:     { type: 'number', description: 'Max files to return (default: 5)' },
      },
      required: ['intent'],
    },
  },
  {
    name: 'vector_search',
    description:
      'Semantic similarity search over the code index. ' +
      'Returns top matching code chunks by TF-IDF cosine similarity.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query (code terms, symbol names, etc.)' },
        topK:  { type: 'number', description: 'Max results (default: 5)' },
      },
      required: ['query'],
    },
  },
  {
    name: 'read_skeleton',
    description:
      'Get the public API skeleton of a TypeScript source string. ' +
      'Returns signatures and JSDoc — no function bodies.',
    inputSchema: {
      type: 'object',
      properties: {
        source:   { type: 'string', description: 'TypeScript source code' },
        fileName: { type: 'string', description: 'Optional: filename hint for diagnostics' },
      },
      required: ['source'],
    },
  },
];

// ── Implementation ────────────────────────────────────────────────────────────

export class AgentToolkit implements IAgentToolkit {
  readonly #ctx: IContextEngine;
  readonly #vec: IVectorIndex;
  readonly #skel: ISkeletonProvider;

  constructor(ctx: IContextEngine, vec: IVectorIndex, skel: ISkeletonProvider) {
    this.#ctx  = ctx;
    this.#vec  = vec;
    this.#skel = skel;
  }

  getTools(): readonly MCPTool[] { return TOOLS; }

  async dispatch(name: string, input: Record<string, unknown>): Promise<ToolCallResult> {
    try {
      switch (name) {
        case 'context_query':  return await this.#contextQuery(input);
        case 'vector_search':  return await this.#vectorSearch(input);
        case 'read_skeleton':  return await this.#readSkeleton(input);
        default:               return err(name, `Unknown tool: ${name}`);
      }
    } catch (e) {
      return err(name, e instanceof Error ? e.message : String(e));
    }
  }

  // ── Private dispatchers ─────────────────────────────────────────────────────

  async #contextQuery(input: Record<string, unknown>): Promise<ToolCallResult> {
    const result = await this.#ctx.query({
      intent:    String(input['intent'] ?? ''),
      scope:     Array.isArray(input['scope']) ? input['scope'] as string[] : undefined,
      maxTokens: typeof input['maxTokens'] === 'number' ? input['maxTokens'] : 3000,
      topK:      typeof input['topK'] === 'number' ? input['topK'] : 5,
    });
    return ok('context_query', result);
  }

  async #vectorSearch(input: Record<string, unknown>): Promise<ToolCallResult> {
    const hits = await this.#vec.search(
      String(input['query'] ?? ''),
      typeof input['topK'] === 'number' ? input['topK'] : 5,
    );
    return ok('vector_search', hits);
  }

  async #readSkeleton(input: Record<string, unknown>): Promise<ToolCallResult> {
    const result = this.#skel.fromContent(
      String(input['source'] ?? ''),
      typeof input['fileName'] === 'string' ? input['fileName'] : 'input.ts',
    );
    return ok('read_skeleton', { skeleton: result.skeleton, compressionRatio: result.compressionRatio });
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function ok(toolName: string, data: unknown): ToolCallResult {
  return { toolName, content: JSON.stringify(data), isError: false };
}

function err(toolName: string, message: string): ToolCallResult {
  return { toolName, content: JSON.stringify({ error: message }), isError: true };
}
