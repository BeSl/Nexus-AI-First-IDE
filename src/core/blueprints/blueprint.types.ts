/**
 * Blueprint System — Type Contracts (Phase 4.1)
 *
 * Blueprints are project scaffolding templates for common platforms.
 * They give the Architect agent a pre-structured starting point,
 * reducing hallucination and enforcing Nexus patterns from the start.
 *
 * @security Blueprint content is static — no user input is interpolated
 *           without going through the escapeValue() sanitizer.
 */

export type BlueprintPlatform = 'web' | 'desktop' | 'mobile' | 'backend' | 'library';

export interface BlueprintManifest {
  readonly id: string;                  // 'node-backend', 'electron', etc.
  readonly name: string;
  readonly platform: BlueprintPlatform;
  readonly description: string;
  readonly tags: readonly string[];
}

/** A file to be scaffolded, with optional template variables */
export interface BlueprintFile {
  /** Relative path from project root. May contain {{name}} variables. */
  readonly path: string;
  /** File content. May contain {{name}}, {{author}}, {{description}} placeholders. */
  readonly content: string;
}

/** Variables available for interpolation in BlueprintFile content/paths */
export interface BlueprintVariables {
  readonly name: string;          // project name, e.g. "my-app"
  readonly author?: string;
  readonly description?: string;
  readonly [key: string]: string | undefined;
}

/** A complete, scaffoldable project template */
export interface IBlueprint {
  readonly manifest: BlueprintManifest;
  /** Generate concrete files by substituting variables into templates */
  scaffold(vars: BlueprintVariables): readonly BlueprintFile[];
}
