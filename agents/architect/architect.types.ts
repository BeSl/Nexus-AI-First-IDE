/**
 * Architect Agent — Type Contracts
 * Responsible for: parsing intent, designing module structure,
 * generating TypeScript interfaces before any implementation.
 * @security Architect output must never include executable code — only schemas/interfaces
 */

import type { AgentId, Artifact } from '../../core/orchestrator.types.js';

/** A parsed, structured representation of user's natural-language intent */
export interface ParsedIntent {
  readonly raw: string;
  readonly summary: string;
  readonly modules: readonly ModuleBlueprint[];
  readonly dependencies: readonly string[];
}

/** Blueprint for a single module — no implementation, only contract */
export interface ModuleBlueprint {
  readonly name: string;
  readonly path: string;
  readonly role: 'core' | 'agent' | 'ui' | 'util';
  readonly interfaces: readonly InterfaceBlueprint[];
  readonly dependsOn: readonly string[];
}

/** A single TypeScript interface to be generated */
export interface InterfaceBlueprint {
  readonly name: string;
  readonly fields: readonly FieldBlueprint[];
  readonly extends?: readonly string[];
}

export interface FieldBlueprint {
  readonly name: string;
  readonly type: string;
  readonly readonly: boolean;
  readonly optional: boolean;
  readonly description?: string;
}

/** What the Architect agent produces */
export interface ArchitectOutput {
  readonly agentId: AgentId;
  readonly intent: ParsedIntent;
  readonly artifacts: readonly Artifact[];
}

export interface IArchitectAgent {
  parseIntent(raw: string): Promise<ParsedIntent>;
  designModules(intent: ParsedIntent): Promise<ArchitectOutput>;
}
