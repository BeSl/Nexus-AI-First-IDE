/**
 * LspToolProvider — MCP Tool adapter for TypeScriptService
 *
 * Exposes TypeScriptService capabilities as MCP tools so Claude agents
 * can query diagnostics, type coverage, and exports during code generation.
 * Implements IAgentToolkit — injected into AgentToolkit as an "extra".
 *
 * Tools provided:
 *   ts_diagnostics    — get TS errors/warnings for a file
 *   ts_type_coverage  — measure `any` usage across files
 *   ts_find_export    — locate a named export symbol
 *
 * @security Read-only. Delegates to ITypeScriptService (no FS writes).
 */

import type { MCPTool } from '../llm/LLMGateway.types.js';
import type { IAgentToolkit, ToolCallResult } from '../llm/AgentToolkit.types.js';
import type { ITypeScriptService } from './lsp.types.js';

// ── Tool schemas ───────────────────────────────────────────────────────────────

const LSP_TOOLS: readonly MCPTool[] = [
  {
    name: 'ts_diagnostics',
    description:
      'Get TypeScript diagnostics (errors and warnings) for a source file. ' +
      'Pass sourceOverride for in-memory (VFS) content.',
    inputSchema: {
      type: 'object',
      properties: {
        filePath:       { type: 'string', description: 'Absolute path to .ts file' },
        sourceOverride: { type: 'string', description: 'Optional: in-memory source content' },
      },
      required: ['filePath'],
    },
  },
  {
    name: 'ts_type_coverage',
    description:
      'Report type coverage — percentage of type nodes that are NOT `any`. ' +
      'Lower percentage means more implicit `any` usage.',
    inputSchema: {
      type: 'object',
      properties: {
        filePaths: {
          type: 'array',
          items: { type: 'string' },
          description: 'Absolute paths to .ts files',
        },
      },
      required: ['filePaths'],
    },
  },
  {
    name: 'ts_find_export',
    description:
      'Locate a named export symbol across given TypeScript files. ' +
      'Returns file path, line number, and export kind (function/class/etc).',
    inputSchema: {
      type: 'object',
      properties: {
        symbolName: { type: 'string', description: 'Exported symbol name to find' },
        filePaths:  {
          type: 'array',
          items: { type: 'string' },
          description: 'Absolute paths to search',
        },
      },
      required: ['symbolName', 'filePaths'],
    },
  },
];

const TOOL_NAMES = new Set(LSP_TOOLS.map((t) => t.name));

// ── Implementation ─────────────────────────────────────────────────────────────

export class LspToolProvider implements IAgentToolkit {
  readonly #ts: ITypeScriptService;

  constructor(tsService: ITypeScriptService) {
    this.#ts = tsService;
  }

  getTools(): readonly MCPTool[] { return LSP_TOOLS; }

  handles(name: string): boolean { return TOOL_NAMES.has(name); }

  async dispatch(name: string, input: Record<string, unknown>): Promise<ToolCallResult> {
    try {
      switch (name) {
        case 'ts_diagnostics':   return this.#diagnostics(input);
        case 'ts_type_coverage': return this.#typeCoverage(input);
        case 'ts_find_export':   return this.#findExport(input);
        default:                 return err(name, `Unknown LSP tool: ${name}`);
      }
    } catch (e) {
      return err(name, e instanceof Error ? e.message : String(e));
    }
  }

  // ── Private dispatchers ──────────────────────────────────────────────────────

  #diagnostics(input: Record<string, unknown>): ToolCallResult {
    const filePath = String(input['filePath'] ?? '');
    const override = typeof input['sourceOverride'] === 'string' ? input['sourceOverride'] : undefined;
    const diags = this.#ts.getDiagnostics(filePath, override);
    return ok('ts_diagnostics', diags);
  }

  #typeCoverage(input: Record<string, unknown>): ToolCallResult {
    const paths = Array.isArray(input['filePaths'])
      ? (input['filePaths'] as unknown[]).map(String)
      : [];
    const result = this.#ts.getTypeCoverage(paths);
    return ok('ts_type_coverage', result);
  }

  #findExport(input: Record<string, unknown>): ToolCallResult {
    const symbolName = String(input['symbolName'] ?? '');
    const paths = Array.isArray(input['filePaths'])
      ? (input['filePaths'] as unknown[]).map(String)
      : [];
    const result = this.#ts.findExport(symbolName, paths);
    return ok('ts_find_export', result);
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function ok(toolName: string, data: unknown): ToolCallResult {
  return { toolName, content: JSON.stringify(data), isError: false };
}

function err(toolName: string, message: string): ToolCallResult {
  return { toolName, content: JSON.stringify({ error: message }), isError: true };
}
