/**
 * AgentToolkit — Type Contracts
 *
 * Bridges the LLM (ILLMGateway) with project intelligence services
 * (ContextEngine, VectorIndex, SkeletonProvider) via MCP tool protocol.
 *
 * @security All tool calls are read-only — no file writes allowed here.
 */

import type { MCPTool } from './LLMGateway.types.js';

/** Result of dispatching a single tool call from the LLM */
export interface ToolCallResult {
  readonly toolName: string;
  /** JSON-serialized payload returned to the LLM as tool_result */
  readonly content: string;
  readonly isError: boolean;
}

export interface IAgentToolkit {
  /** MCP tool definitions — pass directly to ILLMGateway.registerTools() */
  getTools(): readonly MCPTool[];

  /**
   * Dispatch a tool_use call from the LLM to the correct service.
   * Returns ToolCallResult — caller must send it back as tool_result message.
   * @security Never throws — errors are encoded in ToolCallResult.isError
   */
  dispatch(
    toolName: string,
    input: Record<string, unknown>
  ): Promise<ToolCallResult>;
}
