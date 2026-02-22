/**
 * PluginRegistry — Unit Tests
 */
import { describe, it, expect, vi } from 'vitest';
import { PluginRegistry } from './PluginRegistry.js';
import type { IAgentPlugin, PluginManifest } from './plugin.types.js';

function makePlugin(overrides: Partial<PluginManifest> = {}): IAgentPlugin {
  return {
    manifest: {
      id: 'test-plugin',
      name: 'Test Plugin',
      version: '1.0.0',
      description: 'A test plugin',
      slot: 'reviewer',
      ...overrides,
    },
    execute: vi.fn().mockResolvedValue({
      taskId: 'task-1',
      agentId: 'test-plugin' as ReturnType<() => import('../../../core/orchestrator.types.js').AgentId>,
      output: {},
      artifacts: [],
      duration: 0,
    }),
  };
}

describe('PluginRegistry.register', () => {
  it('accepts a valid plugin', () => {
    const r = new PluginRegistry();
    expect(() => r.register(makePlugin())).not.toThrow();
    expect(r.size).toBe(1);
  });

  it('throws on duplicate id', () => {
    const r = new PluginRegistry();
    r.register(makePlugin());
    expect(() => r.register(makePlugin())).toThrow(/already registered/);
  });

  it('throws on invalid version format', () => {
    const r = new PluginRegistry();
    expect(() => r.register(makePlugin({ version: 'v1.0' }))).toThrow(/semver/);
  });

  it('throws on invalid slot', () => {
    const r = new PluginRegistry();
    expect(() => r.register(makePlugin({ slot: 'invalid' as PluginManifest['slot'] }))).toThrow(/slot/);
  });

  it('throws on empty id', () => {
    const r = new PluginRegistry();
    expect(() => r.register(makePlugin({ id: '' }))).toThrow(/id/);
  });
});

describe('PluginRegistry.resolve', () => {
  it('resolves by id', () => {
    const r = new PluginRegistry();
    r.register(makePlugin({ id: 'my-plugin' }));
    expect(r.resolve('my-plugin')).toBeDefined();
  });

  it('returns undefined for unknown id', () => {
    const r = new PluginRegistry();
    expect(r.resolve('unknown')).toBeUndefined();
  });
});

describe('PluginRegistry.unregister', () => {
  it('removes the plugin', () => {
    const r = new PluginRegistry();
    r.register(makePlugin());
    r.unregister('test-plugin');
    expect(r.size).toBe(0);
  });

  it('is a no-op for unknown id', () => {
    const r = new PluginRegistry();
    expect(() => r.unregister('ghost')).not.toThrow();
  });

  it('allows re-registration after unregister', () => {
    const r = new PluginRegistry();
    r.register(makePlugin());
    r.unregister('test-plugin');
    expect(() => r.register(makePlugin())).not.toThrow();
  });
});

describe('PluginRegistry.forSlot', () => {
  it('returns plugins matching the slot', () => {
    const r = new PluginRegistry();
    r.register(makePlugin({ id: 'rev-1', slot: 'reviewer' }));
    r.register(makePlugin({ id: 'test-1', slot: 'tester' }));
    expect(r.forSlot('reviewer')).toHaveLength(1);
    expect(r.forSlot('tester')).toHaveLength(1);
  });

  it('returns empty for unused slot', () => {
    const r = new PluginRegistry();
    expect(r.forSlot('post-tester')).toHaveLength(0);
  });
});

describe('PluginRegistry.listManifests', () => {
  it('lists all registered manifests', () => {
    const r = new PluginRegistry();
    r.register(makePlugin({ id: 'a' }));
    r.register(makePlugin({ id: 'b' }));
    expect(r.listManifests()).toHaveLength(2);
    expect(r.listManifests().map((m) => m.id)).toContain('a');
  });
});
