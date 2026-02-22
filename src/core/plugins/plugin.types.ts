/**
 * Plugin System — Type Contracts (Phase 4.3)
 *
 * Allows Enterprise teams to register custom agent personas
 * into the Nexus Loop without modifying core code.
 *
 * Lifecycle:
 *   1. Plugin author implements IAgentPlugin
 *   2. Plugin registers via PluginRegistry.register()
 *   3. Orchestrator uses PluginRegistry to resolve actors by role
 *
 * @security Plugins run in the same process — validate inputs.
 *           Only whitelist-approved plugins should be registered.
 */

import type { Artifact, AgentResult } from '../../../core/orchestrator.types.js';

/** Input shape passed to every plugin actor */
export interface PluginActorInput {
  readonly taskId: string;
  readonly intent: string;
  readonly artifacts: readonly Artifact[];
  /** Arbitrary context from the orchestrator (e.g. build feedback) */
  readonly context: Readonly<Record<string, unknown>>;
}

/** Metadata every plugin must declare */
export interface PluginManifest {
  /** Unique identifier: 'security-auditor', 'doc-writer', etc. */
  readonly id: string;
  /** Human-readable name shown in the UI */
  readonly name: string;
  readonly version: string;
  readonly description: string;
  /** Which orchestrator slot to inject into: 'reviewer', 'tester', etc. */
  readonly slot: 'reviewer' | 'tester' | 'post-tester';
}

/** Contract every custom agent plugin must implement */
export interface IAgentPlugin {
  readonly manifest: PluginManifest;
  /**
   * Execute the plugin logic.
   * Must return AgentResult with artifacts.
   * @security Never reads from disk directly — use input.artifacts.
   */
  execute(input: PluginActorInput): Promise<AgentResult>;
}
