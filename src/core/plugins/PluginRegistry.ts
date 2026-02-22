/**
 * PluginRegistry — Enterprise Agent Plugin Manager
 *
 * Stores and resolves custom IAgentPlugin instances by manifest.id.
 * Thread-safe within a single Node.js event loop (no async locking needed).
 *
 * @security Only plugins with valid PluginManifest are accepted.
 *           Version string is validated to semver-like format.
 */

import type { IAgentPlugin, PluginManifest } from './plugin.types.js';

const SEMVER_RE = /^\d+\.\d+\.\d+$/;

export class PluginRegistry {
  readonly #plugins = new Map<string, IAgentPlugin>();

  /**
   * Register a plugin. Throws if id is duplicate or manifest is invalid.
   * @security Validates manifest before accepting the plugin.
   */
  register(plugin: IAgentPlugin): void {
    this.#validateManifest(plugin.manifest);
    if (this.#plugins.has(plugin.manifest.id)) {
      throw new Error(`Plugin '${plugin.manifest.id}' is already registered. Unregister first.`);
    }
    this.#plugins.set(plugin.manifest.id, plugin);
  }

  /** Remove a plugin by id. No-op if not registered. */
  unregister(id: string): void {
    this.#plugins.delete(id);
  }

  /** Resolve a plugin by id. Returns undefined if not found. */
  resolve(id: string): IAgentPlugin | undefined {
    return this.#plugins.get(id);
  }

  /** All plugins registered for a given slot */
  forSlot(slot: PluginManifest['slot']): readonly IAgentPlugin[] {
    return [...this.#plugins.values()].filter((p) => p.manifest.slot === slot);
  }

  /** All registered manifests (for UI display) */
  listManifests(): readonly PluginManifest[] {
    return [...this.#plugins.values()].map((p) => p.manifest);
  }

  get size(): number { return this.#plugins.size; }

  // ── Private ─────────────────────────────────────────────────────────────────

  #validateManifest(m: PluginManifest): void {
    if (!m.id || typeof m.id !== 'string' || m.id.trim() === '') {
      throw new Error('Plugin manifest: id must be a non-empty string.');
    }
    if (!SEMVER_RE.test(m.version)) {
      throw new Error(`Plugin manifest: version '${m.version}' must be semver (X.Y.Z).`);
    }
    const validSlots: PluginManifest['slot'][] = ['reviewer', 'tester', 'post-tester'];
    if (!validSlots.includes(m.slot)) {
      throw new Error(`Plugin manifest: slot '${m.slot}' is not valid. Use: ${validSlots.join(', ')}.`);
    }
  }
}
