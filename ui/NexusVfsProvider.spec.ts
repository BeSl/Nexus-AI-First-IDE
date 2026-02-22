/**
 * NexusVfsProvider — Unit Tests
 * vscode is mocked via __mocks__/vscode stub (vitest).
 */

import { describe, it, expect, vi } from 'vitest';

// ── vscode mock (minimal) ─────────────────────────────────────────────────────

vi.mock('vscode', () => ({
  TreeItem: class {
    label: string; collapsibleState: number; description?: string;
    tooltip?: string; contextValue?: string; command?: unknown; iconPath?: unknown;
    constructor(label: string, state: number) { this.label = label; this.collapsibleState = state; }
  },
  TreeItemCollapsibleState: { None: 0, Collapsed: 1, Expanded: 2 },
  ThemeIcon: class { constructor(public id: string) {} },
  EventEmitter: class {
    event = vi.fn();
    fire  = vi.fn();
    dispose = vi.fn();
  },
}));

import { NexusVfsProvider, VfsFileItem } from './NexusVfsProvider.js';
import type { Artifact } from '../core/orchestrator.types.js';

function art(path: string, type: Artifact['type'] = 'file'): Artifact {
  return { type, path, content: `// ${path}` };
}

// ── initial state ─────────────────────────────────────────────────────────────

describe('NexusVfsProvider — initial state', () => {
  it('starts with empty artifacts list', () => {
    const provider = new NexusVfsProvider();
    expect(provider.count).toBe(0);
    expect(provider.artifacts).toHaveLength(0);
  });

  it('getChildren returns empty array initially', () => {
    const provider = new NexusVfsProvider();
    expect(provider.getChildren()).toHaveLength(0);
  });
});

// ── refresh ───────────────────────────────────────────────────────────────────

describe('NexusVfsProvider.refresh', () => {
  it('updates artifact count', () => {
    const provider = new NexusVfsProvider();
    provider.refresh('t1', [art('a.ts'), art('b.ts')]);
    expect(provider.count).toBe(2);
  });

  it('stores taskId', () => {
    const provider = new NexusVfsProvider();
    provider.refresh('my-task-42', [art('x.ts')]);
    expect(provider.taskId).toBe('my-task-42');
  });

  it('getChildren reflects refreshed state immediately', () => {
    const provider = new NexusVfsProvider();
    provider.refresh('t1', [art('a.ts')]);
    expect(provider.getChildren()).toHaveLength(1);
  });

  it('replaces previous artifacts on second refresh', () => {
    const provider = new NexusVfsProvider();
    provider.refresh('t1', [art('a.ts'), art('b.ts')]);
    provider.refresh('t2', [art('c.ts')]);
    expect(provider.count).toBe(1);
    expect(provider.taskId).toBe('t2');
  });
});

// ── clear ─────────────────────────────────────────────────────────────────────

describe('NexusVfsProvider.clear', () => {
  it('resets artifacts to empty', () => {
    const provider = new NexusVfsProvider();
    provider.refresh('t1', [art('a.ts'), art('b.ts')]);
    provider.clear();
    expect(provider.count).toBe(0);
  });

  it('resets taskId to empty string', () => {
    const provider = new NexusVfsProvider();
    provider.refresh('t1', [art('a.ts')]);
    provider.clear();
    expect(provider.taskId).toBe('');
  });
});

// ── getChildren / getTreeItem ─────────────────────────────────────────────────

describe('NexusVfsProvider.getChildren', () => {
  it('returns VfsFileItem for each artifact', () => {
    const provider = new NexusVfsProvider();
    provider.refresh('t1', [art('src/foo.ts'), art('src/bar.ts', 'test')]);
    const children = provider.getChildren();
    expect(children).toHaveLength(2);
    expect(children[0]).toBeInstanceOf(VfsFileItem);
  });

  it('items carry the artifact reference', () => {
    const provider = new NexusVfsProvider();
    const a = art('src/service.ts', 'code');
    provider.refresh('t1', [a]);
    const [item] = provider.getChildren();
    expect(item!.artifact).toBe(a);
    expect(item!.taskId).toBe('t1');
  });

  it('getTreeItem returns the same item', () => {
    const provider = new NexusVfsProvider();
    provider.refresh('t1', [art('x.ts')]);
    const [item] = provider.getChildren();
    expect(provider.getTreeItem(item!)).toBe(item);
  });
});

// ── VfsFileItem ───────────────────────────────────────────────────────────────

describe('VfsFileItem', () => {
  it('uses artifact path as label', () => {
    const item = new VfsFileItem(art('src/foo.ts'), 't1');
    expect(item.label).toBe('src/foo.ts');
  });

  it('sets description to artifact type', () => {
    const item = new VfsFileItem(art('foo.spec.ts', 'test'), 't1');
    expect(item.description).toBe('test');
  });

  it('contextValue is nexusVfsFile', () => {
    const item = new VfsFileItem(art('a.ts'), 't1');
    expect(item.contextValue).toBe('nexusVfsFile');
  });
});
